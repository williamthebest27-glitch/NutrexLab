<?php
/**
 * Nutrex Lab: intestazione delle email degli ordini Nutrex (logo e inizio della scheda).
 * Con il corpo Nutrex (nutrex-order.php) il titolo lo scrive il corpo; con i corpi di WooCommerce
 * (per esempio l'avviso di nuovo ordine all'amministratore) qui si scrive il titolo dell'email.
 *
 * @var string        $email_heading
 * @var WC_Email|null $email
 */

defined( 'ABSPATH' ) || exit;

$nutrex_own  = ! empty( $GLOBALS['nutrex_headless_email_body'] );
$nutrex_pre  = $nutrex_own ? (string) ( $GLOBALS['nutrex_headless_email_preheader'] ?? '' ) : '';
$nutrex_name = 'Nutrex Lab';

echo nutrex_headless_mail_open( $email_heading ? $email_heading . ' · ' . $nutrex_name : $nutrex_name, $nutrex_pre ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

if ( ! $nutrex_own && $email_heading ) {
	$nutrex_c = NUTREX_HEADLESS_MAIL;
	printf(
		'<h1 class="nx-title" style="%s">%s</h1>',
		esc_attr( nutrex_headless_css( array( 'margin' => '0 0 18px', 'font-family' => $nutrex_c['font'], 'font-size' => '28px', 'line-height' => '1.12', 'font-weight' => '800', 'letter-spacing' => '-0.02em', 'color' => $nutrex_c['ink'] ) ) ),
		esc_html( $email_heading )
	);
}
