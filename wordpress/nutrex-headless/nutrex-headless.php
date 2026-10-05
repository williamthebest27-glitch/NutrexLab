<?php
/**
 * Plugin Name:       Nutrex Headless
 * Description:       Collega WooCommerce al negozio nutrexlab.it: il carrello del negozio passa al checkout di WooCommerce, dopo il pagamento il cliente torna su nutrexlab.it, i link e le email degli ordini Nutrex parlano di Nutrex Lab. Il resto del sito non cambia.
 * Version:           2.0.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Requires Plugins:  woocommerce
 * Author:            Nutrex Lab
 * License:           GPLv2 or later
 * Text Domain:       nutrex-headless
 *
 * Il negozio nutrexlab.it mostra i prodotti e il carrello con la Store API di WooCommerce. Per pagare,
 * il cliente arriva al checkout di questo WooCommerce con gli stessi prodotti nel carrello: paga con i
 * metodi gia' attivi qui e l'ordine e' un normale ordine WooCommerce (stock, email, clienti, coupon,
 * spedizioni, tasse, Amazon MCF: tutto come sempre).
 *
 * Impostazioni: WooCommerce > Impostazioni > Avanzate > Nutrex Lab.
 * Riguarda solo i prodotti della categoria Nutrex e gli ordini che li contengono.
 */

defined( 'ABSPATH' ) || exit;

define( 'NUTREX_HEADLESS_VERSION', '2.0.0' );

add_action(
	'plugins_loaded',
	function () {
		if ( ! function_exists( 'WC' ) ) {
			return;
		}
		require_once __DIR__ . '/includes/settings.php';
		require_once __DIR__ . '/includes/checkout-handoff.php';
		require_once __DIR__ . '/includes/frontend-links.php';
		require_once __DIR__ . '/includes/emails.php';
	},
	11
);

/** Indirizzo del negozio (es. https://nutrexlab.it), senza barra finale. Vuoto = nessun link cambiato. */
function nutrex_headless_frontend_url() {
	$url = trim( (string) get_option( 'nutrex_headless_frontend_url', '' ) );
	return $url ? untrailingslashit( esc_url_raw( $url ) ) : '';
}

/** Id della categoria Nutrex e di tutte le sue sottocategorie (vuoto se non impostata). */
function nutrex_headless_category_ids() {
	static $ids = null;
	if ( null !== $ids ) {
		return $ids;
	}
	$ids  = array();
	$slug = sanitize_title( (string) get_option( 'nutrex_headless_category', '' ) );
	$term = $slug ? get_term_by( 'slug', $slug, 'product_cat' ) : null;
	if ( $term ) {
		$ids = array_merge( array( (int) $term->term_id ), array_map( 'intval', get_term_children( $term->term_id, 'product_cat' ) ) );
	}
	return $ids;
}

/** Il prodotto (o la variazione) appartiene alla categoria Nutrex? */
function nutrex_headless_is_product( $product_id ) {
	$ids        = nutrex_headless_category_ids();
	$product_id = absint( $product_id );
	if ( ! $ids || ! $product_id ) {
		return false;
	}
	if ( 'product_variation' === get_post_type( $product_id ) ) {
		$product_id = wp_get_post_parent_id( $product_id );
	}
	// get_the_terms usa la cache dei termini gia' caricata da WordPress (veloce anche negli elenchi)
	$terms = get_the_terms( $product_id, 'product_cat' );
	if ( ! $terms || is_wp_error( $terms ) ) {
		return false;
	}
	return (bool) array_intersect( $ids, array_map( 'intval', wp_list_pluck( $terms, 'term_id' ) ) );
}

/** Ordine con almeno un prodotto Nutrex. */
function nutrex_headless_is_order( $order ) {
	if ( ! $order instanceof WC_Order ) {
		return false;
	}
	foreach ( $order->get_items() as $item ) {
		if ( $item instanceof WC_Order_Item_Product && nutrex_headless_is_product( $item->get_product_id() ) ) {
			return true;
		}
	}
	return false;
}
