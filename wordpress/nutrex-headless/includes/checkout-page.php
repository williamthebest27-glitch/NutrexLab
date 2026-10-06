<?php
/**
 * La pagina di pagamento di Nutrex Lab: una pagina di WordPress tutta sua (non quella del checkout di
 * questo sito), creata dal plugin, con il checkout di WooCommerce (stessi metodi di pagamento,
 * spedizioni e sconti) dentro la cornice di Nutrex Lab (checkout-look.php). Ci arrivano solo i carrelli
 * Nutrex, dal carrello di nutrexlab.it (checkout-handoff.php):
 * - i link a carrello, negozio, termini e privacy portano alle pagine di nutrexlab.it;
 * - "Ordine ricevuto" e "Paga l'ordine" degli ordini Nutrex sono su questa pagina;
 * - niente accesso o creazione di un account di questo sito: si paga come ospite.
 * Non compare nei menu, nelle ricerche e nelle mappe del sito; nell'elenco delle pagine ha l'etichetta
 * "Pagamento Nutrex Lab". La pagina del checkout di questo sito non cambia.
 */

defined( 'ABSPATH' ) || exit;

/** Id della pagina di pagamento di Nutrex Lab (0 se non c'e'). */
function nutrex_headless_checkout_page_id() {
	$id   = absint( get_option( 'nutrex_headless_checkout_page', 0 ) );
	$page = $id ? get_post( $id ) : null;
	return $page && 'page' === $page->post_type && 'publish' === $page->post_status ? $id : 0;
}

/**
 * Crea la pagina se manca (o se e' stata cestinata). Il checkout e' dello stesso tipo di quello di questo
 * sito (blocco Checkout o shortcode classico), cosi' i metodi di pagamento sono gli stessi.
 */
function nutrex_headless_ensure_checkout_page() {
	$id = nutrex_headless_checkout_page_id();
	if ( $id ) {
		return $id;
	}
	$site    = get_post( (int) get_option( 'woocommerce_checkout_page_id' ) );
	$classic = $site && ! has_block( 'woocommerce/checkout', $site ) && has_shortcode( $site->post_content, 'woocommerce_checkout' );
	// (blocco vuoto: WooCommerce lo riempie con il checkout completo di base)
	$content = $classic
		? "<!-- wp:shortcode -->\n[woocommerce_checkout]\n<!-- /wp:shortcode -->"
		: "<!-- wp:woocommerce/checkout -->\n<div class=\"wp-block-woocommerce-checkout alignwide wc-block-checkout is-loading\"></div>\n<!-- /wp:woocommerce/checkout -->";

	// non finisce da sola nei menu che aggiungono le pagine nuove
	$menu = has_action( 'transition_post_status', '_wp_auto_add_pages_to_menu' );
	if ( false !== $menu ) {
		remove_action( 'transition_post_status', '_wp_auto_add_pages_to_menu', $menu );
	}
	$id = wp_insert_post(
		array(
			'post_type'      => 'page',
			'post_status'    => 'publish',
			'post_title'     => 'Pagamento Nutrex Lab',
			'post_name'      => 'pagamento-nutrex-lab',
			'post_content'   => $content,
			'comment_status' => 'closed',
			'ping_status'    => 'closed',
		)
	);
	if ( false !== $menu ) {
		add_action( 'transition_post_status', '_wp_auto_add_pages_to_menu', $menu, 3 );
	}
	if ( ! $id || is_wp_error( $id ) ) {
		return 0;
	}
	update_option( 'nutrex_headless_checkout_page', $id, true );
	return $id;
}

add_action(
	'admin_init',
	function () {
		if ( current_user_can( 'manage_woocommerce' ) && ! nutrex_headless_checkout_page_id() ) {
			nutrex_headless_ensure_checkout_page();
		}
	}
);

/** La richiesta e' la pagina di pagamento di Nutrex Lab (anche "Ordine ricevuto" e "Paga l'ordine")? */
function nutrex_headless_on_checkout_page() {
	static $on = null;
	if ( null !== $on ) {
		return $on;
	}
	if ( ! did_action( 'wp' ) ) {
		return false; // pagina non ancora nota
	}
	$id = nutrex_headless_checkout_page_id();
	$on = $id && is_page( $id );
	return $on;
}

// su questa pagina e' lei il checkout di WooCommerce (pagine "Ordine ricevuto" e "Paga l'ordine", cache)
add_filter(
	'woocommerce_get_checkout_page_id',
	function ( $id ) {
		return nutrex_headless_on_checkout_page() ? nutrex_headless_checkout_page_id() : $id;
	}
);

/*
 * Solo carrelli Nutrex: con un carrello vuoto o di questo sito si torna al carrello di nutrexlab.it
 * (il carrello del visitatore resta com'e'). "Ordine ricevuto" e "Paga l'ordine": solo ordini Nutrex.
 */
add_action(
	'template_redirect',
	function () {
		global $wp;
		if ( ! nutrex_headless_on_checkout_page() ) {
			return;
		}
		nocache_headers();
		$endpoint = absint( $wp->query_vars['order-received'] ?? ( $wp->query_vars['order-pay'] ?? 0 ) );
		if ( $endpoint ) {
			$order = wc_get_order( $endpoint );
			if ( ! $order || ! nutrex_headless_is_order( $order ) ) {
				wp_safe_redirect( home_url( '/' ) );
				exit;
			}
			return;
		}
		if ( ! nutrex_headless_is_nutrex_cart() ) {
			wp_redirect( nutrex_headless_shop_url( '/carrello' ), 302, 'Nutrex Headless' ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
			exit;
		}
	},
	1
);

// gli indirizzi "Ordine ricevuto" e "Paga l'ordine" vecchi (sul checkout di questo sito) degli ordini Nutrex
add_action(
	'template_redirect',
	function () {
		global $wp;
		$page = nutrex_headless_checkout_page_id();
		if ( ! $page || nutrex_headless_on_checkout_page() || ! is_page( (int) get_option( 'woocommerce_checkout_page_id' ) ) ) {
			return;
		}
		foreach ( array( 'order-received', 'order-pay' ) as $endpoint ) {
			$order = empty( $wp->query_vars[ $endpoint ] ) ? null : wc_get_order( absint( $wp->query_vars[ $endpoint ] ) );
			if ( $order && nutrex_headless_is_order( $order ) ) {
				$query = rawurlencode_deep( wp_unslash( $_GET ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				wp_safe_redirect( add_query_arg( $query, wc_get_endpoint_url( $endpoint, $order->get_id(), get_permalink( $page ) ) ) );
				exit;
			}
		}
	},
	1
);

// ---------------------------------------------------------------------------- indirizzi degli ordini Nutrex

/** Lo stesso indirizzo (con i suoi parametri) portato sulla pagina di pagamento Nutrex. */
function nutrex_headless_on_nutrex_page( $url, $order, $endpoint = '' ) {
	$page = nutrex_headless_checkout_page_id();
	if ( ! $page || ! $order instanceof WC_Order || ! nutrex_headless_is_order( $order ) ) {
		return $url;
	}
	$query = array();
	wp_parse_str( (string) wp_parse_url( html_entity_decode( (string) $url ), PHP_URL_QUERY ), $query );
	$base = $endpoint ? wc_get_endpoint_url( $endpoint, $order->get_id(), get_permalink( $page ) ) : get_permalink( $page );
	return add_query_arg( rawurlencode_deep( $query ), $base );
}

add_filter(
	'woocommerce_get_checkout_order_received_url',
	function ( $url, $order ) {
		return nutrex_headless_on_nutrex_page( $url, $order, 'order-received' );
	},
	20,
	2
);

add_filter(
	'woocommerce_get_checkout_payment_url',
	function ( $url, $order ) {
		return nutrex_headless_on_nutrex_page( $url, $order, 'order-pay' );
	},
	20,
	2
);

// annullamento dal metodo di pagamento: si torna alla pagina Nutrex, non al carrello di questo sito
add_filter(
	'woocommerce_get_cancel_order_url_raw',
	function ( $url, $order ) {
		return nutrex_headless_on_nutrex_page( $url, $order );
	},
	20,
	2
);
add_filter(
	'woocommerce_get_cancel_order_url',
	function ( $url, $order ) {
		$nutrex = nutrex_headless_on_nutrex_page( $url, $order );
		return $nutrex === $url ? $url : esc_url( $nutrex );
	},
	20,
	2
);

// ---------------------------------------------------------------------------- sulla pagina

// carrello, negozio, termini, privacy e account: le pagine di nutrexlab.it
add_filter(
	'woocommerce_get_cart_url',
	function ( $url ) {
		return nutrex_headless_on_checkout_page() ? nutrex_headless_shop_url( '/carrello' ) : $url;
	}
);

add_filter(
	'woocommerce_return_to_shop_redirect',
	function ( $url ) {
		return nutrex_headless_on_checkout_page() ? nutrex_headless_shop_url( '/acquista' ) : $url;
	}
);

add_filter(
	'page_link',
	function ( $link, $page_id ) {
		if ( ! nutrex_headless_on_checkout_page() ) {
			return $link;
		}
		$pages = array(
			(int) get_option( 'woocommerce_cart_page_id' )      => '/carrello',
			(int) get_option( 'woocommerce_shop_page_id' )      => '/acquista',
			(int) get_option( 'woocommerce_myaccount_page_id' ) => '/',
			(int) wc_terms_and_conditions_page_id()             => '/termini-e-condizioni',
			(int) get_option( 'wp_page_for_privacy_policy' )    => '/privacy-policy',
		);
		unset( $pages[0] );
		return isset( $pages[ (int) $page_id ] ) ? nutrex_headless_shop_url( $pages[ (int) $page_id ] ) : $link;
	},
	20,
	2
);

add_filter(
	'privacy_policy_url',
	function ( $url ) {
		return nutrex_headless_on_checkout_page() ? nutrex_headless_shop_url( '/privacy-policy' ) : $url;
	}
);

/** Pagamento Nutrex in corso: la pagina, o la Store API con un carrello Nutrex. */
function nutrex_headless_nutrex_checkout_context() {
	if ( nutrex_headless_on_checkout_page() ) {
		return true;
	}
	return nutrex_headless_is_rest() && did_action( 'woocommerce_cart_loaded_from_session' ) && nutrex_headless_is_nutrex_cart();
}

// si paga come ospite: niente accesso o account di questo sito
foreach (
	array(
		'woocommerce_enable_guest_checkout'                 => 'yes',
		'woocommerce_enable_checkout_login_reminder'        => 'no',
		'woocommerce_enable_signup_and_login_from_checkout' => 'no',
		'woocommerce_enable_delayed_account_creation'       => 'no',
	) as $nutrex_headless_option => $nutrex_headless_value
) {
	add_filter(
		'pre_option_' . $nutrex_headless_option,
		function ( $pre ) use ( $nutrex_headless_value ) {
			return nutrex_headless_nutrex_checkout_context() ? $nutrex_headless_value : $pre;
		}
	);
}

// le richieste del checkout da questa pagina si riconoscono (ultimo controllo del carrello, separation.php)
add_action(
	'wp_enqueue_scripts',
	function () {
		if ( nutrex_headless_on_checkout_page() ) {
			wp_add_inline_script( 'wp-api-fetch', 'wp.apiFetch.use(function(o,n){o.headers=Object.assign({},o.headers,{"X-Nutrex-Checkout":"1"});return n(o);});' );
		}
	},
	20
);

// ---------------------------------------------------------------------------- fuori da menu, ricerche e mappe

add_filter(
	'display_post_states',
	function ( $states, $post ) {
		if ( $post->ID && nutrex_headless_checkout_page_id() === $post->ID ) {
			$states['nutrex_headless'] = __( 'Pagamento Nutrex Lab, usata dal plugin: non modificarla', 'nutrex-headless' );
		}
		return $states;
	},
	10,
	2
);

add_filter(
	'wp_robots',
	function ( $robots ) {
		if ( nutrex_headless_on_checkout_page() ) {
			$robots['noindex']  = true;
			$robots['nofollow'] = true;
		}
		return $robots;
	}
);

add_filter(
	'wp_sitemaps_posts_query_args',
	function ( $args, $post_type ) {
		$id = nutrex_headless_checkout_page_id();
		if ( 'page' === $post_type && $id ) {
			$args['post__not_in'] = array_merge( (array) ( $args['post__not_in'] ?? array() ), array( $id ) ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in
		}
		return $args;
	},
	10,
	2
);

add_filter(
	'wpseo_exclude_from_sitemap_by_post_ids',
	function ( $ids ) {
		$id = nutrex_headless_checkout_page_id();
		return $id ? array_merge( (array) $ids, array( $id ) ) : $ids;
	}
);

add_filter(
	'wp_list_pages_excludes',
	function ( $ids ) {
		$id = nutrex_headless_checkout_page_id();
		return $id ? array_merge( (array) $ids, array( $id ) ) : $ids;
	}
);

add_action(
	'pre_get_posts',
	function ( $q ) {
		$id = nutrex_headless_checkout_page_id();
		if ( $id && ! is_admin() && $q->is_main_query() && $q->is_search() ) {
			$q->set( 'post__not_in', array_merge( (array) $q->get( 'post__not_in' ), array( $id ) ) );
		}
	}
);
