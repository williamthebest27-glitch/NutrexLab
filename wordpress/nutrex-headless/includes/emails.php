<?php
/**
 * Email degli ordini con prodotti Nutrex (WooCommerce condiviso con un altro marchio): mittente e nome
 * del sito di Nutrex Lab e, con l'aspetto Nutrex attivo, anche logo, colore e pie' di pagina.
 * Le altre email non cambiano.
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

/** Nome del mittente e del sito nelle email Nutrex ('' = nessun cambio). */
function nutrex_headless_email_name() {
	$custom = trim( (string) get_option( 'nutrex_headless_email_from_name', '' ) );
	if ( $custom ) {
		return $custom;
	}
	return nutrex_headless_look_enabled() ? 'Nutrex Lab' : '';
}

add_filter(
	'woocommerce_email_from_name',
	function ( $name, $email ) {
		$custom = nutrex_headless_email_name();
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

// {site_title} e il nome del sito nell'oggetto e nel titolo delle email degli ordini Nutrex
add_filter(
	'woocommerce_email_format_string',
	function ( $string, $email ) {
		$custom = nutrex_headless_email_name();
		if ( ! $custom || ! nutrex_headless_email_order( $email ) ) {
			return $string;
		}
		$site = wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES );
		return $site ? str_replace( $site, $custom, $string ) : $string;
	},
	10,
	2
);

/*
  Aspetto Nutrex nel corpo dell'email: dall'intestazione fino all'invio, le impostazioni email di
  WooCommerce (logo, colore, pie' di pagina) e il nome del sito diventano quelli di Nutrex Lab.
*/
$GLOBALS['nutrex_headless_email_look'] = false;

add_action(
	'woocommerce_email_header',
	function ( $heading, $email = null ) {
		$GLOBALS['nutrex_headless_email_look'] = nutrex_headless_look_enabled() && nutrex_headless_email_order( $email );
	},
	1,
	2
);

$nutrex_headless_email_done = function ( $value = null ) {
	$GLOBALS['nutrex_headless_email_look'] = false;
	return $value;
};
add_filter( 'woocommerce_mail_content', $nutrex_headless_email_done, PHP_INT_MAX ); // email pronta (stili compresi)
add_action( 'woocommerce_email_sent', $nutrex_headless_email_done );

/** Valore Nutrex di un'impostazione mentre si scrive un'email Nutrex (altrimenti quello del sito). */
function nutrex_headless_email_option( $value, $nutrex ) {
	return empty( $GLOBALS['nutrex_headless_email_look'] ) ? $value : $nutrex();
}
add_filter( 'option_woocommerce_email_header_image', fn( $v ) => nutrex_headless_email_option( $v, fn() => nutrex_headless_asset( 'nutrex-logo-email.png' ) ) );
add_filter( 'option_woocommerce_email_base_color', fn( $v ) => nutrex_headless_email_option( $v, fn() => '#9e2e65' ) );
add_filter( 'option_woocommerce_email_footer_text', fn( $v ) => nutrex_headless_email_option( $v, fn() => 'Nutrex Lab' ) );
add_filter( 'option_blogname', fn( $v ) => nutrex_headless_email_option( $v, fn() => nutrex_headless_email_name() ?: $v ) );
