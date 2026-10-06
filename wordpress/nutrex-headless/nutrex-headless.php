<?php
/**
 * Plugin Name:       Nutrex Headless
 * Description:       Collega WooCommerce al negozio nutrexlab.it tenendo separati i due negozi: Nutrex Lab ha la sua pagina di pagamento, il suo carrello, la sua area clienti (sconto primo ordine, invita un amico) e le sue email (da info@nutrexlab.it); i prodotti Nutrex non compaiono e non si comprano su questo sito; pagine, carrello e ordini di questo sito non cambiano. In comune restano prodotti, magazzino, metodi di pagamento, sconti e Amazon MCF.
 * Version:           2.3.1
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Requires Plugins:  woocommerce
 * Author:            Nutrex Lab
 * License:           GPLv2 or later
 * Text Domain:       nutrex-headless
 *
 * Il negozio nutrexlab.it mostra i prodotti e il carrello con la Store API di WooCommerce. Per pagare,
 * il cliente arriva alla pagina di pagamento di Nutrex Lab (una pagina sua, creata dal plugin) con gli
 * stessi prodotti: paga con i metodi gia' attivi qui e l'ordine e' un normale ordine WooCommerce (stock,
 * coupon e sconti, spedizioni, tasse, Amazon MCF: tutto come sempre).
 *
 * Impostazioni: WooCommerce > Impostazioni > Avanzate > Nutrex Lab.
 * Riguarda solo i prodotti della categoria Nutrex e gli ordini fatti solo di prodotti Nutrex: gli altri
 * ordini, le loro email e il resto del sito restano come sono.
 */

defined( 'ABSPATH' ) || exit;

define( 'NUTREX_HEADLESS_VERSION', '2.3.1' );
define( 'NUTREX_HEADLESS_FILE', __FILE__ );

add_action(
	'plugins_loaded',
	function () {
		if ( ! function_exists( 'WC' ) ) {
			return;
		}
		require_once __DIR__ . '/includes/mail.php';
		require_once __DIR__ . '/includes/email-look.php';
		require_once __DIR__ . '/includes/settings.php';
		require_once __DIR__ . '/includes/separation.php';
		require_once __DIR__ . '/includes/checkout-page.php';
		require_once __DIR__ . '/includes/account.php';
		require_once __DIR__ . '/includes/checkout-handoff.php';
		require_once __DIR__ . '/includes/frontend-links.php';
		require_once __DIR__ . '/includes/checkout-look.php';
		require_once __DIR__ . '/includes/emails.php';
		require_once __DIR__ . '/includes/import.php';
		require_once __DIR__ . '/includes/contact.php';
		require_once __DIR__ . '/includes/reviews.php';
	},
	11
);

/** URL di un file del plugin (cartella assets). */
function nutrex_headless_asset( $file ) {
	return plugins_url( 'assets/' . $file, NUTREX_HEADLESS_FILE );
}

/**
 * Indirizzo del negozio (es. https://www.nutrexlab.it): solo protocollo e dominio, anche se
 * nell'impostazione c'e' un percorso (es. /acquista). Vuoto = link dei prodotti Nutrex non cambiati.
 */
function nutrex_headless_frontend_url() {
	$url   = esc_url_raw( trim( (string) get_option( 'nutrex_headless_frontend_url', '' ) ) );
	$parts = $url ? wp_parse_url( $url ) : null;
	if ( empty( $parts['host'] ) ) {
		return '';
	}
	return ( $parts['scheme'] ?? 'https' ) . '://' . $parts['host'] . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' );
}

/** Indirizzo di una pagina del negozio Nutrex (senza impostazione: www.nutrexlab.it). */
function nutrex_headless_shop_url( $path = '' ) {
	$front = nutrex_headless_frontend_url();
	return ( $front ? $front : 'https://www.nutrexlab.it' ) . $path;
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

/**
 * Ordine Nutrex: solo prodotti Nutrex, come il carrello del checkout Nutrex. Un ordine che contiene anche
 * prodotti di questo sito resta del sito (pagine, email, mittente). I prodotti poi cancellati non contano.
 */
function nutrex_headless_is_order( $order ) {
	if ( ! $order instanceof WC_Order ) {
		return false;
	}
	$nutrex = false;
	foreach ( $order->get_items() as $item ) {
		if ( ! $item instanceof WC_Order_Item_Product || ! $item->get_product_id() || ! get_post( $item->get_product_id() ) ) {
			continue;
		}
		if ( ! nutrex_headless_is_product( $item->get_product_id() ) ) {
			return false;
		}
		$nutrex = true;
	}
	return $nutrex;
}
