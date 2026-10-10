<?php
/**
 * Dal carrello di nutrexlab.it alla pagina di pagamento di Nutrex Lab (checkout-page.php).
 *
 *   /?nutrex-checkout=1&items=<id>:<quantita>,<id>:<quantita>&coupons=<codice>,<codice>
 *
 * Mette nel carrello WooCommerce del visitatore gli stessi prodotti (o variazioni) con le stesse
 * quantita' e gli stessi coupon, poi apre la pagina di pagamento Nutrex. I prezzi non arrivano
 * dall'indirizzo: li calcola WooCommerce. Si aggiungono solo prodotti della categoria Nutrex; se uno non
 * e' disponibile, WooCommerce lo segnala nel checkout come fa sempre. Se il visitatore aveva nel
 * carrello prodotti di questo sito, restano da parte e tornano appena riapre una pagina di questo sito
 * (separation.php).
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'wp_loaded',
	function () {
		if ( empty( $_GET['nutrex-checkout'] ) || is_admin() || wp_doing_ajax() || wp_doing_cron() ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}
		if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}
		if ( ! WC()->cart || ! WC()->session ) {
			return;
		}

		// risposta personale (carrello del visitatore): mai nella cache delle pagine o del CDN
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		nocache_headers();

		$back    = nutrex_headless_lang_url( nutrex_headless_shop_url( '/carrello' ) );
		$items   = array_filter( explode( ',', sanitize_text_field( wp_unslash( $_GET['items'] ?? '' ) ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$coupons = array_filter( array_map( 'wc_format_coupon_code', explode( ',', sanitize_text_field( wp_unslash( $_GET['coupons'] ?? '' ) ) ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page    = nutrex_headless_category_ids() ? nutrex_headless_ensure_checkout_page() : 0;
		if ( ! $items || ! $page ) {
			wp_redirect( $back, 302, 'Nutrex Headless' ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
			exit;
		}

		// il cliente ospite deve avere la sua sessione WooCommerce (cookie) prima di riempire il carrello
		WC()->session->set_customer_session_cookie( true );
		WC()->session->set( 'nutrex_headless', null ); // (segno delle versioni precedenti, non piu' usato)

		// il carrello di questo sito resta da parte (non si perde e non si mescola con quello Nutrex)
		$other = array_filter(
			WC()->cart->get_cart_for_session(),
			function ( $item ) {
				return ! nutrex_headless_is_product( $item['product_id'] );
			}
		);
		if ( $other ) {
			WC()->session->set(
				'nutrex_headless_saved',
				array(
					'cart'    => $other,
					'coupons' => WC()->cart->get_applied_coupons(),
				)
			);
		}
		WC()->cart->empty_cart();

		$GLOBALS['nutrex_headless_handoff'] = true;
		foreach ( array_slice( $items, 0, 50 ) as $item ) {
			$parts   = explode( ':', $item );
			$id      = absint( $parts[0] );
			$qty     = isset( $parts[1] ) ? absint( $parts[1] ) : 1;
			$product = $id ? wc_get_product( $id ) : null;
			if ( ! $product || ! $qty || ! nutrex_headless_is_product( $product->get_id() ) ) {
				continue;
			}
			if ( $product->is_type( 'variation' ) ) {
				WC()->cart->add_to_cart( $product->get_parent_id(), min( $qty, 999 ), $product->get_id(), $product->get_variation_attributes() );
			} else {
				WC()->cart->add_to_cart( $product->get_id(), min( $qty, 999 ) );
			}
		}
		foreach ( array_slice( $coupons, 0, 5 ) as $code ) {
			if ( $code && ! WC()->cart->has_discount( $code ) ) {
				WC()->cart->apply_coupon( $code );
			}
		}
		$GLOBALS['nutrex_headless_handoff'] = false;

		// nessun prodotto disponibile: si torna al carrello di nutrexlab.it (senza avvisi per questo sito)
		if ( WC()->cart->is_empty() ) {
			wc_clear_notices();
			wp_redirect( $back, 302, 'Nutrex Headless' ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
			exit;
		}

		wp_safe_redirect( get_permalink( $page ) );
		exit;
	},
	30
);
