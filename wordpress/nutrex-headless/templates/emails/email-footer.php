<?php
/**
 * Nutrex Lab: chiusura delle email degli ordini Nutrex. Ai clienti anche il riquadro "Hai bisogno di
 * aiuto?" (email e WhatsApp); all'amministratore solo il pie' di pagina.
 *
 * @var WC_Email|null $email
 */

defined( 'ABSPATH' ) || exit;

$email = isset( $email ) && $email instanceof WC_Email ? $email : ( $GLOBALS['nutrex_headless_email_which'] ?? null );

echo nutrex_headless_mail_close( ! ( $email instanceof WC_Email ) || $email->is_customer_email() ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
