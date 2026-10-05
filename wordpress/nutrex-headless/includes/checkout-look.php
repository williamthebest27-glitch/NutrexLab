<?php
/**
 * Checkout con l'aspetto di Nutrex Lab per i clienti che arrivano dal negozio Nutrex: logo, colori e
 * caratteri di Nutrex, senza intestazione, menu e pie' di pagina del tema di questo sito. Il contenuto
 * resta quello di WooCommerce (dati, spedizione, metodi di pagamento, riepilogo): cambia la cornice.
 * Vale per il checkout (carrello con soli prodotti Nutrex), per "Ordine ricevuto" e "Paga l'ordine"
 * (ordini Nutrex). Il carrello di WooCommerce di un cliente Nutrex porta al carrello del negozio.
 * Tutto il resto del sito non cambia.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Il carrello WooCommerce del visitatore e' un carrello Nutrex? Si' se contiene solo prodotti Nutrex,
 * oppure se e' vuoto ma il visitatore e' arrivato dal negozio Nutrex (passaggio al checkout).
 */
function nutrex_headless_is_nutrex_cart() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return false;
	}
	$items = WC()->cart->get_cart();
	if ( ! $items ) {
		return WC()->session && WC()->session->get( 'nutrex_headless' );
	}
	foreach ( $items as $item ) {
		if ( ! nutrex_headless_is_product( $item['product_id'] ) ) {
			return false;
		}
	}
	return true;
}

/** L'ordine della pagina "Ordine ricevuto" o "Paga l'ordine", se e' un ordine Nutrex con la chiave giusta. */
function nutrex_headless_endpoint_order() {
	global $wp;
	$id    = absint( $wp->query_vars['order-received'] ?? ( $wp->query_vars['order-pay'] ?? 0 ) );
	$order = $id ? wc_get_order( $id ) : null;
	$key   = isset( $_GET['key'] ) ? wc_clean( wp_unslash( $_GET['key'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( ! $order || ! $key || ! hash_equals( $order->get_order_key(), $key ) || ! nutrex_headless_is_order( $order ) ) {
		return null;
	}
	return $order;
}

/** Quale pagina Nutrex si sta aprendo: 'checkout', 'received', 'pay' o '' (aspetto normale del sito). */
function nutrex_headless_look() {
	static $look = null;
	if ( null !== $look ) {
		return $look;
	}
	if ( ! did_action( 'wp' ) ) {
		return ''; // pagina non ancora nota: si decide dopo
	}
	$look = '';
	if ( ! nutrex_headless_look_enabled() || ! function_exists( 'is_checkout' ) || ! is_checkout() ) {
		return $look;
	}
	if ( is_order_received_page() ) {
		$look = nutrex_headless_endpoint_order() ? 'received' : '';
	} elseif ( is_checkout_pay_page() ) {
		$look = nutrex_headless_endpoint_order() ? 'pay' : '';
	} elseif ( nutrex_headless_is_nutrex_cart() ) {
		$look = 'checkout';
	}
	return $look;
}

// carrello di un cliente Nutrex: il suo carrello e' sul negozio Nutrex (stessi prodotti)
add_filter(
	'woocommerce_get_cart_url',
	function ( $url ) {
		if ( ! is_admin() && nutrex_headless_look_enabled() && did_action( 'wp_loaded' ) && nutrex_headless_is_nutrex_cart() ) {
			return nutrex_headless_frontend_url() . '/carrello';
		}
		return $url;
	}
);

add_filter(
	'woocommerce_return_to_shop_redirect',
	function ( $url ) {
		return nutrex_headless_look_enabled() && nutrex_headless_is_nutrex_cart() ? nutrex_headless_frontend_url() . '/acquista' : $url;
	}
);

add_action(
	'template_redirect',
	function () {
		if ( nutrex_headless_look_enabled() && function_exists( 'is_cart' ) && is_cart() && nutrex_headless_is_nutrex_cart() ) {
			wp_redirect( nutrex_headless_frontend_url() . '/carrello', 302, 'Nutrex Headless' );
			exit;
		}
		if ( ! nutrex_headless_look() ) {
			return;
		}
		// niente CSS aggiuntivo del tema (Personalizza) ne' avviso del negozio
		remove_action( 'wp_head', 'wp_custom_css_cb', 101 );
		remove_action( 'wp_footer', 'woocommerce_demo_store' );
	},
	20
);

// la pagina si apre con il modello del plugin (cornice Nutrex) al posto di quello del tema
add_filter(
	'template_include',
	function ( $template ) {
		return nutrex_headless_look() ? dirname( __DIR__ ) . '/templates/checkout.php' : $template;
	},
	PHP_INT_MAX
);

add_action(
	'wp_enqueue_scripts',
	function () {
		if ( ! nutrex_headless_look() ) {
			return;
		}
		// via i fogli di stile del tema: la pagina usa quelli di WooCommerce e di Nutrex
		$styles = wp_styles();
		$theme  = array_unique( array( get_template_directory_uri(), get_stylesheet_directory_uri() ) );
		foreach ( $styles->queue as $handle ) {
			$src = isset( $styles->registered[ $handle ] ) ? (string) $styles->registered[ $handle ]->src : '';
			foreach ( $theme as $base ) {
				if ( $src && 0 === strpos( $src, $base ) ) {
					wp_dequeue_style( $handle );
				}
			}
		}
		wp_enqueue_style( 'nutrex-headless-checkout', nutrex_headless_asset( 'checkout.css' ), array(), NUTREX_HEADLESS_VERSION );
	},
	100
);

// i fogli di stile di WooCommerce, anche se il tema li sostituisce con i suoi
add_filter(
	'woocommerce_enqueue_styles',
	function ( $styles ) {
		if ( ! nutrex_headless_look() ) {
			return $styles;
		}
		$base = WC()->plugin_url() . '/assets/css/';
		return array(
			'woocommerce-layout'      => array( 'src' => $base . 'woocommerce-layout.css', 'deps' => '', 'version' => WC()->version, 'media' => 'all', 'has_rtl' => true ),
			'woocommerce-smallscreen' => array( 'src' => $base . 'woocommerce-smallscreen.css', 'deps' => 'woocommerce-layout', 'version' => WC()->version, 'media' => 'only screen and (max-width: 768px)', 'has_rtl' => true ),
			'woocommerce-general'     => array( 'src' => $base . 'woocommerce.css', 'deps' => '', 'version' => WC()->version, 'media' => 'all', 'has_rtl' => true ),
		);
	},
	PHP_INT_MAX
);

// titolo della scheda del browser e icona
add_filter(
	'pre_get_document_title',
	function ( $title ) {
		$titles = array(
			'checkout' => __( 'Pagamento sicuro', 'nutrex-headless' ),
			'received' => __( 'Ordine ricevuto', 'nutrex-headless' ),
			'pay'      => __( 'Pagamento dell\'ordine', 'nutrex-headless' ),
		);
		$look = nutrex_headless_look();
		return $look ? $titles[ $look ] . ' | Nutrex Lab' : $title;
	},
	PHP_INT_MAX
);

add_filter(
	'get_site_icon_url',
	function ( $url ) {
		return nutrex_headless_look() ? nutrex_headless_asset( 'nutrex-icon.svg' ) : $url;
	},
	PHP_INT_MAX
);

/** Titolo grande della pagina. */
function nutrex_headless_look_title() {
	$titles = array(
		'checkout' => __( 'Pagamento', 'nutrex-headless' ),
		'received' => __( 'Ordine ricevuto', 'nutrex-headless' ),
		'pay'      => __( 'Pagamento dell\'ordine', 'nutrex-headless' ),
	);
	return $titles[ nutrex_headless_look() ] ?? '';
}
