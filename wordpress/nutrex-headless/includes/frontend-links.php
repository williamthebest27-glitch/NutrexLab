<?php
/**
 * Link verso il negozio nutrexlab.it, solo per cio' che appartiene a Nutrex (con "Indirizzo del
 * negozio" impostato):
 * - dopo il pagamento di un ordine Nutrex il cliente torna su nutrexlab.it/ordine;
 * - i prodotti Nutrex hanno il link /prodotto/<slug> del negozio (anche nelle email e in "Visualizza
 *   prodotto" del pannello) e la loro pagina WordPress porta a quella del negozio;
 * - le pagine delle categorie Nutrex di questo sito portano al negozio Nutrex.
 * Tutto il resto del sito non cambia.
 */

defined( 'ABSPATH' ) || exit;

/** La pagina "Grazie" del negozio per questo ordine. */
function nutrex_headless_thanks_url( $order ) {
	return add_query_arg( 'numero', rawurlencode( $order->get_order_number() ), nutrex_headless_shop_url( '/ordine' ) );
}

/**
 * Dopo il pagamento si apre come sempre la pagina "Ordine ricevuto" di WooCommerce: i metodi di
 * pagamento che chiudono li' il pagamento (es. Stripe con Klarna o altri metodi a reindirizzamento)
 * lo fanno prima di questo passaggio, e WooCommerce svuota il suo carrello. Poi, se l'ordine e' pagato,
 * il cliente passa a nutrexlab.it/ordine.
 * Restano su WooCommerce, con il pulsante per tornare su Nutrex Lab: bonifico e assegno (le istruzioni
 * per pagare sono su quella pagina) e i pagamenti non ancora confermati o non riusciti.
 */
add_action(
	'template_redirect',
	function () {
		global $wp;
		if ( ! nutrex_headless_frontend_url() || ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() ) {
			return;
		}
		$order = wc_get_order( absint( $wp->query_vars['order-received'] ?? 0 ) );
		$key   = isset( $_GET['key'] ) ? wc_clean( wp_unslash( $_GET['key'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! $order || ! $key || ! hash_equals( $order->get_order_key(), $key ) || ! nutrex_headless_is_order( $order ) ) {
			return;
		}
		if ( in_array( $order->get_payment_method(), array( 'bacs', 'cheque' ), true ) || ! $order->has_status( array( 'processing', 'completed', 'on-hold' ) ) ) {
			return;
		}
		wp_redirect( nutrex_headless_thanks_url( $order ), 302, 'Nutrex Headless' );
		exit;
	},
	100
);

// pulsante "Torna su Nutrex Lab" nella pagina "Ordine ricevuto" quando il cliente resta su WooCommerce
add_action(
	'woocommerce_thankyou',
	function ( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order || $order->has_status( 'failed' ) || ! nutrex_headless_is_order( $order ) ) {
			return;
		}
		printf(
			'<p class="nutrex-headless-return"><a class="button" href="%s">%s</a></p>',
			esc_url( nutrex_headless_thanks_url( $order ) ),
			esc_html__( 'Torna su Nutrex Lab', 'nutrex-headless' )
		);
	},
	5
);

add_filter(
	'post_type_link',
	function ( $link, $post ) {
		$front = nutrex_headless_frontend_url();
		if ( $front && 'product' === $post->post_type && $post->post_name && nutrex_headless_is_product( $post->ID ) ) {
			return $front . '/prodotto/' . rawurlencode( $post->post_name );
		}
		return $link;
	},
	10,
	2
);

add_action(
	'template_redirect',
	function () {
		if ( ! nutrex_headless_frontend_url() || ! function_exists( 'is_product' ) || ! is_product() || current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$id = get_queried_object_id();
		if ( $id && nutrex_headless_is_product( $id ) ) {
			// permanente (301): per Google la pagina del prodotto e' quella del negozio. Senza cache nel
			// browser, come prima: chi amministra vede ancora la pagina WooCommerce anche dopo averla aperta da non collegato
			nocache_headers();
			wp_redirect( get_permalink( $id ), 301, 'Nutrex Headless' );
			exit;
		}
	}
);

add_action(
	'template_redirect',
	function () {
		if ( ! nutrex_headless_frontend_url() || ! function_exists( 'is_product_category' ) || ! is_product_category() || current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$term = get_queried_object();
		if ( $term instanceof WP_Term && in_array( (int) $term->term_id, nutrex_headless_category_ids(), true ) ) {
			// permanente (301), direttamente su /integratori (la pagina di tutti i prodotti; /acquista porta li')
			nocache_headers();
			wp_redirect( nutrex_headless_frontend_url() . '/integratori', 301, 'Nutrex Headless' ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
			exit;
		}
	}
);
