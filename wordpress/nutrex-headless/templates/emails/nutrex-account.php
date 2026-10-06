<?php
/**
 * Nutrex Lab: email dell'account ai clienti registrati da Nutrex Lab: account creato, nuova password.
 * Le variabili sono quelle dei modelli di WooCommerce (email, email_heading, user_login, blogname,
 * additional_content; per il nuovo account user_pass, password_generated, set_password_url; per la
 * password reset_key, user_id). I link portano all'area clienti Nutrex.
 *
 * @var WC_Email $email
 */

defined( 'ABSPATH' ) || exit;

$nutrex_user    = $email->object instanceof WP_User ? $email->object : get_user_by( 'login', $user_login );
$nutrex_nome    = $nutrex_user && $nutrex_user->first_name ? $nutrex_user->first_name : '';
$nutrex_account = nutrex_headless_account_url();

if ( 'customer_reset_password' === $email->id ) {
	$nutrex_link = add_query_arg( array( 'key' => $reset_key, 'id' => $user_id ), wc_get_endpoint_url( 'lost-password', '', $nutrex_account ) );
	$nutrex_copy = array(
		'eyebrow'   => 'Password',
		'title'     => 'Scegli una nuova password.',
		'lines'     => array(
			sprintf( 'Qualcuno ha chiesto di cambiare la password dell\'account Nutrex Lab di <strong>%s</strong>. Se sei stato tu, premi il pulsante e scegli la nuova password.', esc_html( $user_login ) ),
			'Se non sei stato tu, ignora questa email: la password resta quella di sempre.',
		),
		'button'    => array( 'label' => 'Scegli la nuova password', 'url' => $nutrex_link ),
		'preheader' => 'Scegli la nuova password del tuo account Nutrex Lab',
	);
} else {
	$nutrex_cfg   = nutrex_headless_account_config();
	$nutrex_lines = array( 'Il tuo account Nutrex Lab è pronto: da qui segui i tuoi ordini, salvi gli indirizzi e inviti i tuoi amici.' );
	if ( $nutrex_user && nutrex_headless_primo_ordine_libero( $nutrex_user->ID ) ) {
		$nutrex_lines[] = sprintf( 'Sul tuo primo ordine hai il <strong>%s%% di sconto</strong>: si applica da solo al pagamento.', nutrex_headless_pct( $nutrex_cfg['sconto_membri'] ) );
	}
	$nutrex_lines[] = sprintf( 'Il tuo nome utente è <strong>%s</strong>.', esc_html( $user_login ) );
	$nutrex_copy    = array(
		'eyebrow'   => 'Account creato',
		'title'     => $nutrex_nome ? sprintf( 'Benvenuto, %s.', esc_html( $nutrex_nome ) ) : 'Benvenuto in Nutrex Lab.',
		'lines'     => $nutrex_lines,
		'button'    => ! empty( $password_generated ) && ! empty( $set_password_url )
			? array( 'label' => 'Imposta la password', 'url' => $set_password_url )
			: array( 'label' => 'Vai al tuo account', 'url' => $nutrex_account ),
		'preheader' => 'Il tuo account Nutrex Lab è pronto',
	);
}

// l'intestazione Nutrex non ripete il titolo di WooCommerce: lo scrive l'apertura qui sotto
$GLOBALS['nutrex_headless_email_body']      = true;
$GLOBALS['nutrex_headless_email_preheader'] = $nutrex_copy['preheader'];

do_action( 'woocommerce_email_header', $email_heading, $email );

echo nutrex_headless_mail_hero( $nutrex_copy['eyebrow'], $nutrex_copy['title'], $nutrex_copy['lines'], $nutrex_copy['button'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

if ( ! empty( $additional_content ) ) {
	echo wp_kses_post( wpautop( wptexturize( $additional_content ) ) );
}

do_action( 'woocommerce_email_footer', $email );

$GLOBALS['nutrex_headless_email_body']      = false;
$GLOBALS['nutrex_headless_email_preheader'] = '';
