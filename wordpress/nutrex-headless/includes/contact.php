<?php
/**
 * Modulo contatti di nutrexlab.it: il sito (funzione /api/contatto su Vercel) manda qui il messaggio e
 * questo WordPress lo spedisce a info@nutrexlab.it (impostazione "Messaggi del modulo contatti a"),
 * con "Rispondi" che va direttamente a chi ha scritto.
 *
 *   POST /wp-json/nutrex/v1/contatto  { nome, email, tema, prodotto, messaggio, sito }
 *
 * "sito" e' un campo nascosto che le persone non vedono: se e' pieno, a scrivere e' un programma.
 * Al massimo 5 messaggi all'ora dalla stessa persona e 60 all'ora in tutto.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'nutrex/v1',
			'/contatto',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => 'nutrex_headless_contact_message',
			)
		);
	}
);

/** Indirizzo di chi scrive (dalla funzione del sito, che lo passa in X-Nutrex-Client). */
function nutrex_headless_contact_ip( WP_REST_Request $request ) {
	$ip = trim( (string) $request->get_header( 'x_nutrex_client' ) );
	if ( $ip && filter_var( $ip, FILTER_VALIDATE_IP ) ) {
		return $ip;
	}
	return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
}

function nutrex_headless_contact_message( WP_REST_Request $request ) {
	$p    = (array) ( $request->get_json_params() ? $request->get_json_params() : $request->get_body_params() );
	$text = function ( $key, $max ) use ( $p ) {
		$value = isset( $p[ $key ] ) && is_scalar( $p[ $key ] ) ? (string) $p[ $key ] : '';
		return mb_substr( trim( sanitize_text_field( $value ) ), 0, $max );
	};

	// campo trappola pieno: si risponde "inviato" senza inviare niente
	if ( '' !== $text( 'sito', 200 ) ) {
		return array( 'ok' => true );
	}

	$nome      = $text( 'nome', 100 );
	$email     = sanitize_email( $text( 'email', 200 ) );
	$tema      = $text( 'tema', 80 );
	$prodotto  = $text( 'prodotto', 120 );
	$messaggio = isset( $p['messaggio'] ) && is_scalar( $p['messaggio'] ) ? mb_substr( trim( sanitize_textarea_field( (string) $p['messaggio'] ) ), 0, 5000 ) : '';

	if ( mb_strlen( $nome ) < 2 ) {
		return new WP_Error( 'nutrex_contact_name', 'Inserisci il tuo nome.', array( 'status' => 400 ) );
	}
	if ( ! is_email( $email ) ) {
		return new WP_Error( 'nutrex_contact_email', 'Inserisci un indirizzo email valido.', array( 'status' => 400 ) );
	}
	if ( mb_strlen( $messaggio ) < 5 ) {
		return new WP_Error( 'nutrex_contact_message', 'Scrivi il tuo messaggio.', array( 'status' => 400 ) );
	}

	// limiti: per persona e in tutto
	$who   = 'nutrex_contact_' . md5( nutrex_headless_contact_ip( $request ) );
	$count = (int) get_transient( $who );
	$all   = (int) get_transient( 'nutrex_contact_all' );
	if ( $count >= 5 || $all >= 60 ) {
		return new WP_Error( 'nutrex_contact_limit', 'Hai inviato molti messaggi in poco tempo: riprova tra un po\'.', array( 'status' => 429 ) );
	}
	set_transient( $who, $count + 1, HOUR_IN_SECONDS );
	set_transient( 'nutrex_contact_all', $all + 1, HOUR_IN_SECONDS );

	$c     = NUTREX_HEADLESS_MAIL;
	$row   = function ( $label, $value ) use ( $c ) {
		return '<tr><td valign="top" style="' . esc_attr( nutrex_headless_css( array( 'padding' => '8px 16px 8px 0', 'width' => '110px', 'font-family' => $c['font'], 'font-size' => '12px', 'font-weight' => '700', 'letter-spacing' => '0.12em', 'text-transform' => 'uppercase', 'color' => $c['muted'] ) ) ) . '">' . esc_html( $label ) . '</td>'
			. '<td valign="top" style="' . esc_attr( nutrex_headless_css( array( 'padding' => '8px 0', 'font-family' => $c['font'], 'font-size' => '15px', 'line-height' => '1.5', 'color' => $c['ink'] ) ) ) . '">' . $value . '</td></tr>';
	};
	$rows  = $row( 'Nome', esc_html( $nome ) )
		. $row( 'Email', '<a href="mailto:' . esc_attr( $email ) . '" style="color:' . esc_attr( $c['berry'] ) . ';">' . esc_html( $email ) . '</a>' )
		. ( $tema ? $row( 'Argomento', esc_html( $tema ) ) : '' )
		. ( $prodotto ? $row( 'Prodotto', esc_html( $prodotto ) ) : '' );
	$body  = nutrex_headless_mail_hero( 'Modulo contatti', 'Nuovo messaggio dal sito.', array( 'Per rispondere basta premere <strong>Rispondi</strong>: la risposta va direttamente a chi ha scritto.' ) );
	$body .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px;">' . $rows . '</table>';
	$body .= '<div style="' . esc_attr( nutrex_headless_css( array( 'margin' => '14px 0 0', 'padding' => '18px 22px', 'background' => $c['soft'], 'border-radius' => '14px', 'font-family' => $c['font'], 'font-size' => '15px', 'line-height' => '1.65', 'color' => $c['ink'] ) ) ) . '">' . nl2br( esc_html( $messaggio ) ) . '</div>';

	$html    = nutrex_headless_mail_document(
		array(
			'title'     => 'Nuovo messaggio dal sito',
			'preheader' => $nome . ': ' . mb_substr( $messaggio, 0, 90 ),
			'body'      => $body,
			'help'      => false,
		)
	);
	$reply   = str_replace( array( "\r", "\n", '"', '<', '>' ), '', $nome );
	$subject = sprintf( 'Messaggio dal sito: %s · %s', $tema ? $tema : 'Contatti', $reply );
	$sent    = nutrex_headless_send( nutrex_headless_contact_address(), $subject, $html, array( sprintf( 'Reply-To: "%s" <%s>', $reply, $email ) ), 'contact' );

	if ( ! $sent ) {
		return new WP_Error( 'nutrex_contact_send', 'Invio non riuscito.', array( 'status' => 502 ) );
	}
	return array( 'ok' => true );
}
