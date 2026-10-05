<?php
/**
 * Email degli ordini con prodotti Nutrex con il mittente di Nutrex Lab (WooCommerce condiviso con un
 * altro marchio): nome e indirizzo del mittente e il nome del sito nei testi ({site_title}).
 * Le altre email non cambiano. Senza impostazioni non cambia nulla.
 */

defined( 'ABSPATH' ) || exit;

/** L'ordine di cui parla l'email, se contiene prodotti Nutrex. */
function nutrex_headless_email_order( $email ) {
	if ( ! $email instanceof WC_Email ) {
		return null;
	}
	$object = $email->object;
	if ( $object instanceof WC_Order_Refund ) {
		$object = wc_get_order( $object->get_parent_id() );
	}
	return nutrex_headless_is_order( $object ) ? $object : null;
}

add_filter(
	'woocommerce_email_from_name',
	function ( $name, $email ) {
		$custom = trim( (string) get_option( 'nutrex_headless_email_from_name', '' ) );
		return $custom && nutrex_headless_email_order( $email ) ? $custom : $name;
	},
	10,
	2
);

add_filter(
	'woocommerce_email_from_address',
	function ( $address, $email ) {
		$custom = sanitize_email( (string) get_option( 'nutrex_headless_email_from_address', '' ) );
		return $custom && nutrex_headless_email_order( $email ) ? $custom : $address;
	},
	10,
	2
);

// {site_title} e il nome del sito nei testi delle email degli ordini Nutrex
add_filter(
	'woocommerce_email_format_string',
	function ( $string, $email ) {
		$custom = trim( (string) get_option( 'nutrex_headless_email_from_name', '' ) );
		if ( ! $custom || ! nutrex_headless_email_order( $email ) ) {
			return $string;
		}
		$site = wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES );
		return $site ? str_replace( $site, $custom, $string ) : $string;
	},
	10,
	2
);
