<?php
/**
 * La cornice di Nutrex Lab sulla sua pagina di pagamento (checkout-page.php): logo, colori e caratteri
 * di Nutrex, senza intestazione, menu e pie' di pagina del tema di questo sito. Il contenuto resta quello
 * di WooCommerce (dati, spedizione, metodi di pagamento, riepilogo). Vale solo su quella pagina:
 * checkout, "Ordine ricevuto" e "Paga l'ordine" degli ordini Nutrex. Le pagine di questo sito (anche il
 * suo checkout e il suo carrello) non cambiano mai.
 */

defined( 'ABSPATH' ) || exit;

/** Quale pagina Nutrex si sta aprendo: 'checkout', 'received', 'pay' o '' (non e' la pagina Nutrex). */
function nutrex_headless_look() {
	static $look = null;
	if ( null !== $look ) {
		return $look;
	}
	if ( ! did_action( 'wp' ) ) {
		return ''; // pagina non ancora nota: si decide dopo
	}
	$look = '';
	if ( ! nutrex_headless_on_checkout_page() ) {
		return $look;
	}
	if ( is_order_received_page() ) {
		$look = 'received';
	} elseif ( is_checkout_pay_page() ) {
		$look = 'pay';
	} else {
		$look = 'checkout';
	}
	return $look;
}

add_action(
	'template_redirect',
	function () {
		if ( ! nutrex_headless_look() ) {
			return;
		}
		// niente CSS aggiuntivo del tema (Personalizza), avviso del negozio o feed di questo sito
		remove_action( 'wp_head', 'wp_custom_css_cb', 101 );
		remove_action( 'wp_footer', 'woocommerce_demo_store' );
		remove_action( 'wp_head', 'feed_links', 2 );
		remove_action( 'wp_head', 'feed_links_extra', 3 );
		remove_action( 'wp_head', 'rsd_link' );
		remove_action( 'wp_head', 'wlwmanifest_link' );
	},
	20
);

// sulla pagina Nutrex il nome del sito e' Nutrex Lab (testi di WooCommerce e dei metodi di pagamento, meta)
add_filter(
	'option_blogname',
	function ( $name ) {
		return nutrex_headless_look() ? 'Nutrex Lab' : $name;
	}
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
