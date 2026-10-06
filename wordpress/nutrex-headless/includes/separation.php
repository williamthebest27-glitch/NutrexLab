<?php
/**
 * Due negozi separati sullo stesso WooCommerce. In comune restano prodotti, magazzino, metodi di
 * pagamento, sconti e Amazon MCF; il resto e' separato:
 * - i prodotti Nutrex si comprano solo da nutrexlab.it: su questo sito non compaiono (negozio, ricerche,
 *   categorie, prodotti correlati), la loro pagina porta a nutrexlab.it e non vanno nel carrello;
 * - i prodotti di questo sito non si comprano da nutrexlab.it;
 * - un carrello, e quindi un ordine, non contiene mai prodotti dei due negozi insieme;
 * - il carrello di questo sito non si perde: se un visitatore passa al pagamento di Nutrex Lab, il suo
 *   carrello di questo sito resta da parte e torna com'era appena riapre una pagina di questo sito;
 * - le notifiche degli ordini e del magazzino Nutrex arrivano a Nutrex Lab, non a questo sito.
 * Pagine, prodotti, carrelli, ordini ed email di questo sito non cambiano.
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------- carrello

/** Il carrello WooCommerce del visitatore contiene solo prodotti Nutrex (almeno uno)? */
function nutrex_headless_is_nutrex_cart() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart || ! nutrex_headless_category_ids() ) {
		return false;
	}
	$items = WC()->cart->get_cart();
	if ( ! $items ) {
		return false;
	}
	foreach ( $items as $item ) {
		if ( ! nutrex_headless_is_product( $item['product_id'] ) ) {
			return false;
		}
	}
	return true;
}

/** Il carrello contiene almeno un prodotto Nutrex? */
function nutrex_headless_cart_has_nutrex() {
	if ( ! function_exists( 'WC' ) || ! WC()->cart || ! nutrex_headless_category_ids() ) {
		return false;
	}
	foreach ( WC()->cart->get_cart() as $item ) {
		if ( nutrex_headless_is_product( $item['product_id'] ) ) {
			return true;
		}
	}
	return false;
}

/** Richiesta REST (API di WordPress e Store API di WooCommerce). */
function nutrex_headless_is_rest() {
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return true;
	}
	$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	return false !== strpos( $uri, '/' . trim( rest_get_url_prefix(), '/' ) . '/' ) || isset( $_GET['rest_route'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
}

/** Carrello del negozio nutrexlab.it: la Store API chiamata dal suo server, con il Cart-Token. */
function nutrex_headless_is_shop_cart_request() {
	if ( empty( $_SERVER['HTTP_CART_TOKEN'] ) || ! nutrex_headless_is_rest() ) {
		return false;
	}
	$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	return false !== strpos( $uri, '/wc/store/' ) || false !== strpos( (string) ( $_GET['rest_route'] ?? '' ), '/wc/store/' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
}

/**
 * Pagine e chiamate AJAX di questo sito (non la pagina di pagamento Nutrex, non le API): qui i prodotti
 * Nutrex non ci sono.
 */
function nutrex_headless_is_storefront() {
	if ( wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) || nutrex_headless_is_rest() ) {
		return false;
	}
	if ( is_admin() ) {
		// pannello: mai; admin-ajax solo se chiamato dalle pagine del sito (es. filtri dei prodotti del tema)
		$referer = (string) wp_get_raw_referer();
		if ( ! wp_doing_ajax() || '' === $referer || false !== strpos( $referer, '/wp-admin/' ) ) {
			return false;
		}
	}
	return ! nutrex_headless_on_checkout_page();
}

/**
 * Il carrello di questo sito torna com'era: via i prodotti Nutrex (e i loro codici sconto) rimasti dopo
 * un passaggio al pagamento di Nutrex Lab, e di nuovo dentro i prodotti messi da parte in quel momento.
 */
function nutrex_headless_restore_store_cart() {
	if ( ! WC()->cart || ! WC()->session ) {
		return;
	}
	$saved    = WC()->session->get( 'nutrex_headless_saved' );
	$contents = WC()->cart->get_cart();
	$kept     = array_filter(
		$contents,
		function ( $item ) {
			return ! nutrex_headless_is_product( $item['product_id'] );
		}
	);
	if ( count( $kept ) === count( $contents ) && ! is_array( $saved ) ) {
		return;
	}
	// i codici sconto di un carrello tutto Nutrex erano del negozio Nutrex
	$coupons = $kept ? WC()->cart->get_applied_coupons() : array();
	if ( is_array( $saved ) ) {
		foreach ( (array) ( $saved['cart'] ?? array() ) as $key => $item ) {
			if ( isset( $kept[ $key ] ) || empty( $item['product_id'] ) || nutrex_headless_is_product( $item['product_id'] ) ) {
				continue;
			}
			$product = wc_get_product( ! empty( $item['variation_id'] ) ? $item['variation_id'] : $item['product_id'] );
			if ( ! $product || ! $product->exists() ) {
				continue;
			}
			$item['data'] = $product;
			$kept[ $key ] = $item;
		}
		$coupons = array_values( array_unique( array_merge( $coupons, (array) ( $saved['coupons'] ?? array() ) ) ) );
		WC()->session->set( 'nutrex_headless_saved', null );
	}
	WC()->cart->set_cart_contents( $kept );
	WC()->cart->set_applied_coupons( $coupons );
	WC()->cart->calculate_totals();
}

// ogni pagina di questo sito mostra il carrello di questo sito
add_action(
	'template_redirect',
	function () {
		if ( ! WC()->cart || ! WC()->session || ! nutrex_headless_is_storefront() ) {
			return;
		}
		if ( nutrex_headless_cart_has_nutrex() || WC()->session->get( 'nutrex_headless_saved' ) ) {
			nutrex_headless_restore_store_cart();
		}
	},
	5
);

/*
 * Cosa entra nel carrello:
 * - passaggio da nutrexlab.it al pagamento (checkout-handoff.php): solo prodotti Nutrex;
 * - carrello di nutrexlab.it (Store API con Cart-Token): mai insieme a prodotti di questo sito;
 * - pagine di questo sito: mai prodotti Nutrex (e i Nutrex rimasti lasciano il posto al carrello di prima).
 */
add_filter(
	'woocommerce_add_to_cart_validation',
	function ( $passed, $product_id ) {
		if ( ! $passed || ! nutrex_headless_category_ids() || ! WC()->cart ) {
			return $passed;
		}
		$nutrex = nutrex_headless_is_product( $product_id );
		if ( ! empty( $GLOBALS['nutrex_headless_handoff'] ) ) {
			return $nutrex;
		}
		if ( nutrex_headless_is_shop_cart_request() ) {
			foreach ( WC()->cart->get_cart() as $item ) {
				if ( nutrex_headless_is_product( $item['product_id'] ) !== $nutrex ) {
					wc_add_notice( __( 'Questo prodotto non può essere acquistato insieme a quelli già nel carrello.', 'nutrex-headless' ), 'error' );
					return false;
				}
			}
			return $passed;
		}
		if ( $nutrex ) {
			wc_add_notice( __( 'Questo prodotto non è disponibile in questo negozio.', 'nutrex-headless' ), 'error' );
			return false;
		}
		nutrex_headless_restore_store_cart();
		return $passed;
	},
	20,
	2
);

/*
 * Ultimo controllo prima di pagare: mai un ordine con prodotti dei due negozi, e dalla pagina di
 * pagamento Nutrex (intestazione X-Nutrex-Checkout, vedi checkout-page.php) solo prodotti Nutrex.
 */
add_action(
	'woocommerce_check_cart_items',
	function () {
		if ( ! nutrex_headless_category_ids() || ! WC()->cart || WC()->cart->is_empty() ) {
			return;
		}
		$nutrex = 0;
		$other  = 0;
		foreach ( WC()->cart->get_cart() as $item ) {
			nutrex_headless_is_product( $item['product_id'] ) ? $nutrex++ : $other++;
		}
		if ( $nutrex && $other ) {
			wc_add_notice( __( 'Nel carrello ci sono prodotti che non si possono acquistare insieme: controlla il carrello e riprova.', 'nutrex-headless' ), 'error' );
		} elseif ( $other && ( nutrex_headless_on_checkout_page() || ! empty( $_SERVER['HTTP_X_NUTREX_CHECKOUT'] ) ) ) {
			wc_add_notice( __( 'Il carrello è cambiato: torna al carrello di Nutrex Lab e riprova.', 'nutrex-headless' ), 'error' );
		}
	}
);

// ---------------------------------------------------------------------------- prodotti Nutrex nascosti su questo sito

/** Condizione che toglie le categorie Nutrex da una ricerca di prodotti. */
function nutrex_headless_exclude_tax_query() {
	return array(
		'taxonomy'         => 'product_cat',
		'field'            => 'term_id',
		'terms'            => nutrex_headless_category_ids(),
		'operator'         => 'NOT IN',
		'include_children' => false,
	);
}

/** Aggiunge l'esclusione dei prodotti Nutrex a un tax_query. */
function nutrex_headless_without_nutrex( $tax_query ) {
	$tax_query = is_array( $tax_query ) ? $tax_query : array();
	return $tax_query ? array( 'relation' => 'AND', $tax_query, nutrex_headless_exclude_tax_query() ) : array( nutrex_headless_exclude_tax_query() );
}

// negozio, categorie e ricerche dei prodotti
add_filter(
	'woocommerce_product_query_tax_query',
	function ( $tax_query ) {
		if ( nutrex_headless_category_ids() && nutrex_headless_is_storefront() ) {
			$tax_query[] = nutrex_headless_exclude_tax_query();
		}
		return $tax_query;
	}
);

// shortcode [products] e widget dei costruttori di pagine che lo usano
add_filter(
	'woocommerce_shortcode_products_query',
	function ( $args ) {
		if ( nutrex_headless_category_ids() && nutrex_headless_is_storefront() ) {
			$args['tax_query'] = nutrex_headless_without_nutrex( $args['tax_query'] ?? array() ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		}
		return $args;
	}
);

// blocchi con elenchi di prodotti (Product Collection, Query Loop)
add_filter(
	'query_loop_block_query_vars',
	function ( $query ) {
		if ( nutrex_headless_category_ids() && nutrex_headless_is_storefront() && in_array( 'product', (array) ( $query['post_type'] ?? array() ), true ) ) {
			$query['tax_query'] = nutrex_headless_without_nutrex( $query['tax_query'] ?? array() ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		}
		return $query;
	},
	20
);

// ricerca generale del sito
add_action(
	'pre_get_posts',
	function ( $q ) {
		if ( ! $q->is_main_query() || ! $q->is_search() || 'product' === $q->get( 'post_type' ) || ! nutrex_headless_category_ids() || ! nutrex_headless_is_storefront() ) {
			return;
		}
		$q->set( 'tax_query', nutrex_headless_without_nutrex( $q->get( 'tax_query' ) ) );
	}
);

// prodotti correlati, upsell, cross-sell, widget ed elenchi che controllano la visibilita'
add_filter(
	'woocommerce_product_is_visible',
	function ( $visible, $product_id ) {
		return $visible && ! ( nutrex_headless_is_storefront() && nutrex_headless_is_product( $product_id ) );
	},
	20,
	2
);

// categorie nella pagina del negozio e nel widget delle categorie (le pagine delle categorie Nutrex
// portano a nutrexlab.it, frontend-links.php). Solo gli elenchi: le categorie dei prodotti non cambiano.
add_filter(
	'woocommerce_product_subcategories_args',
	function ( $args ) {
		if ( nutrex_headless_category_ids() && nutrex_headless_is_storefront() ) {
			$args['exclude'] = array_merge( wp_parse_id_list( $args['exclude'] ?? array() ), nutrex_headless_category_ids() );
		}
		return $args;
	}
);
foreach ( array( 'woocommerce_product_categories_widget_args', 'woocommerce_product_categories_widget_dropdown_args' ) as $nutrex_headless_hook ) {
	add_filter(
		$nutrex_headless_hook,
		function ( $args ) {
			if ( nutrex_headless_category_ids() && nutrex_headless_is_storefront() ) {
				$args['exclude_tree'] = array_merge( wp_parse_id_list( $args['exclude_tree'] ?? array() ), nutrex_headless_category_ids() );
			}
			return $args;
		}
	);
}

// ---------------------------------------------------------------------------- notifiche a Nutrex Lab

/** Dove arrivano le notifiche degli ordini e del magazzino Nutrex. */
function nutrex_headless_orders_address() {
	$to = sanitize_email( (string) get_option( 'nutrex_headless_orders_to', '' ) );
	return $to ? $to : nutrex_headless_contact_address();
}

foreach ( array( 'new_order', 'cancelled_order', 'failed_order' ) as $nutrex_headless_email_id ) {
	add_filter(
		'woocommerce_email_recipient_' . $nutrex_headless_email_id,
		function ( $recipient, $order ) {
			return $order instanceof WC_Order && nutrex_headless_is_order( $order ) ? nutrex_headless_orders_address() : $recipient;
		},
		20,
		2
	);
}

/** Prodotto di una notifica del magazzino (scorte basse, esaurito, ordine in attesa di scorte). */
function nutrex_headless_stock_product( $subject ) {
	$product = is_array( $subject ) ? ( $subject['product'] ?? null ) : $subject;
	return $product instanceof WC_Product && nutrex_headless_is_product( $product->get_id() ) ? $product : null;
}

foreach ( array( 'low_stock', 'no_stock', 'backorder' ) as $nutrex_headless_email_id ) {
	add_filter(
		'woocommerce_email_recipient_' . $nutrex_headless_email_id,
		function ( $recipient, $subject ) {
			return nutrex_headless_stock_product( $subject ) ? nutrex_headless_orders_address() : $recipient;
		},
		20,
		2
	);
	add_filter(
		'woocommerce_email_subject_' . $nutrex_headless_email_id,
		function ( $title, $subject ) {
			if ( ! nutrex_headless_stock_product( $subject ) ) {
				return $title;
			}
			$site = wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES );
			return $site ? str_replace( $site, 'Nutrex Lab', $title ) : $title;
		},
		20,
		2
	);
}
