<?php
/**
 * Nutrex Lab: corpo delle email al cliente per gli ordini Nutrex (conferma, in attesa di pagamento,
 * completato, dettagli e pagamento, nota, rimborso, annullato, pagamento non riuscito).
 * Apertura con titolo e testo per il tipo di email, poi riepilogo dell'ordine, indirizzi e aiuto.
 * Le variabili sono quelle dei modelli di WooCommerce (order, email, email_heading, sent_to_admin,
 * plain_text, additional_content, customer_note, partial_refund).
 *
 * @var WC_Order $order
 * @var WC_Email $email
 */

defined( 'ABSPATH' ) || exit;

$nutrex_copy = nutrex_headless_email_copy( $email, $order, get_defined_vars() );

// l'intestazione Nutrex non ripete il titolo di WooCommerce: lo scrive l'apertura qui sotto
$GLOBALS['nutrex_headless_email_body']      = true;
$GLOBALS['nutrex_headless_email_preheader'] = $nutrex_copy['preheader'];

/*
 * @hooked WC_Emails::email_header() Intestazione
 */
do_action( 'woocommerce_email_header', $email_heading, $email );

echo nutrex_headless_mail_hero( $nutrex_copy['eyebrow'], $nutrex_copy['title'], $nutrex_copy['lines'], $nutrex_copy['button'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

if ( ! empty( $nutrex_copy['note'] ) ) {
	$nutrex_c = NUTREX_HEADLESS_MAIL;
	printf(
		'<div style="%s">%s</div>',
		esc_attr( nutrex_headless_css( array( 'margin' => '6px 0 4px', 'padding' => '16px 20px', 'border-left' => '3px solid ' . $nutrex_c['berry'], 'background' => $nutrex_c['soft'], 'border-radius' => '0 12px 12px 0', 'font-family' => $nutrex_c['font'], 'font-size' => '15px', 'line-height' => '1.6', 'color' => $nutrex_c['ink'] ) ) ),
		wp_kses_post( wpautop( make_clickable( wc_wptexturize_order_note( $nutrex_copy['note'] ) ) ) )
	);
}

/*
 * @hooked WC_Emails::order_details() Riepilogo dell'ordine (e istruzioni di pagamento dei metodi che le hanno)
 * @hooked WC_Structured_Data::generate_order_data() Dati strutturati
 * @hooked WC_Structured_Data::output_structured_data() Dati strutturati
 */
do_action( 'woocommerce_email_order_details', $order, $sent_to_admin, $plain_text, $email );

/*
 * @hooked WC_Emails::order_meta() Altri dati dell'ordine
 */
do_action( 'woocommerce_email_order_meta', $order, $sent_to_admin, $plain_text, $email );

/*
 * @hooked WC_Emails::customer_details() Dati del cliente
 * @hooked WC_Emails::email_address() Indirizzi
 */
do_action( 'woocommerce_email_customer_details', $order, $sent_to_admin, $plain_text, $email );

/*
 * @hooked WC_Emails::email_footer() Aiuto e pie' di pagina
 */
do_action( 'woocommerce_email_footer', $email );

$GLOBALS['nutrex_headless_email_body']      = false;
$GLOBALS['nutrex_headless_email_preheader'] = '';
