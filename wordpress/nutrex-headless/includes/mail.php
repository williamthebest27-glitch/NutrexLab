<?php
/**
 * Invio delle email Nutrex dal server di posta di nutrexlab.it (SMTP con la casella info@nutrexlab.it):
 * le email degli ordini Nutrex e i messaggi del modulo contatti partono da info@nutrexlab.it e sono
 * firmate dal suo dominio (SPF, DKIM e DMARC in regola: niente cartella spam). Spedite da questo
 * WordPress con quel mittente, il DMARC di nutrexlab.it le farebbe finire nello spam.
 * Se il server di posta non risponde (password cambiata, porta chiusa) l'email parte comunque con il
 * mittente normale di questo sito e l'errore compare nelle impostazioni: nessun cliente resta senza.
 * Le altre email del sito non cambiano.
 */

defined( 'ABSPATH' ) || exit;

/** Valori di base: la casella info@nutrexlab.it sul server di posta di VHosting. */
define(
	'NUTREX_HEADLESS_SMTP_DEFAULTS',
	array(
		'host'   => 'mailserver5.vhosting-it.com',
		'secure' => 'tls',
		'user'   => 'info@nutrexlab.it',
	)
);

/** Impostazioni SMTP complete (host, porta, sicurezza, utente, password) oppure null se manca qualcosa. */
function nutrex_headless_smtp() {
	$host = trim( (string) get_option( 'nutrex_headless_smtp_host', NUTREX_HEADLESS_SMTP_DEFAULTS['host'] ) );
	$user = trim( (string) get_option( 'nutrex_headless_smtp_user', NUTREX_HEADLESS_SMTP_DEFAULTS['user'] ) );
	$pass = nutrex_headless_secret_read( (string) get_option( 'nutrex_headless_smtp_pass', '' ) );
	if ( '' === $host || '' === $user || '' === $pass ) {
		return null;
	}
	$secure = 'ssl' === get_option( 'nutrex_headless_smtp_secure', NUTREX_HEADLESS_SMTP_DEFAULTS['secure'] ) ? 'ssl' : 'tls';
	$port   = absint( get_option( 'nutrex_headless_smtp_port', '' ) );
	if ( ! $port ) {
		$port = 'ssl' === $secure ? 465 : 587;
	}
	return compact( 'host', 'port', 'secure', 'user', 'pass' );
}

/** Indirizzo mittente delle email Nutrex ('' = mittente normale di WooCommerce). */
function nutrex_headless_sender_address() {
	$custom = sanitize_email( (string) get_option( 'nutrex_headless_email_from_address', '' ) );
	if ( $custom ) {
		return $custom;
	}
	$smtp = nutrex_headless_smtp();
	return $smtp && is_email( $smtp['user'] ) ? $smtp['user'] : '';
}

/** Dove arrivano i messaggi del modulo contatti di nutrexlab.it. */
function nutrex_headless_contact_address() {
	$to = sanitize_email( (string) get_option( 'nutrex_headless_contact_to', '' ) );
	return $to ? $to : ( nutrex_headless_sender_address() ? nutrex_headless_sender_address() : 'info@nutrexlab.it' );
}

/*
 * Invio in corso: nutrex_headless_mail = 'contact' (modulo contatti) o 'test' (prova dalle
 * impostazioni) per le email spedite da nutrex_headless_send(); le email degli ordini Nutrex si
 * riconoscono dal mittente (info@nutrexlab.it, impostato da emails.php). Con nutrex_headless_mail_plain
 * l'invio di riserva, senza SMTP e con il mittente normale del sito.
 */
$GLOBALS['nutrex_headless_mail']       = '';
$GLOBALS['nutrex_headless_mail_plain'] = false;
$GLOBALS['nutrex_headless_mail_smtp']  = false;

add_action(
	'phpmailer_init',
	function ( $mailer ) {
		$GLOBALS['nutrex_headless_mail_smtp'] = false;
		if ( ! empty( $GLOBALS['nutrex_headless_mail_plain'] ) ) {
			return;
		}
		$smtp = nutrex_headless_smtp();
		$from = nutrex_headless_sender_address();
		if ( ! $smtp || ! $from ) {
			return;
		}
		// solo le email Nutrex: quelle di questo plugin o quelle di WooCommerce con il mittente Nutrex
		if ( empty( $GLOBALS['nutrex_headless_mail'] ) && 0 !== strcasecmp( (string) $mailer->From, $from ) ) {
			return;
		}
		$mailer->isSMTP();
		$mailer->Host        = $smtp['host'];
		$mailer->Port        = $smtp['port'];
		$mailer->SMTPAuth    = true;
		$mailer->Username    = $smtp['user'];
		$mailer->Password    = $smtp['pass'];
		$mailer->SMTPSecure  = $smtp['secure'];
		$mailer->SMTPAutoTLS = true;
		$mailer->Timeout     = 20;
		$mailer->setFrom( $from, $mailer->FromName ? $mailer->FromName : 'Nutrex Lab', false );
		// indirizzo di ritorno sullo stesso dominio del mittente: SPF allineato per il DMARC
		$mailer->Sender = $mailer->From;

		$GLOBALS['nutrex_headless_mail_smtp'] = true;
	},
	PHP_INT_MAX - 10 // dopo eventuali plugin SMTP del sito, solo per le email Nutrex
);

add_action(
	'wp_mail_succeeded',
	function () {
		if ( ! empty( $GLOBALS['nutrex_headless_mail_smtp'] ) ) {
			$GLOBALS['nutrex_headless_mail_smtp'] = false;
			update_option( 'nutrex_headless_smtp_ok', time(), false );
		}
	}
);

/*
 * Il server di posta di nutrexlab.it non ha accettato l'email: si riprova subito con il mittente
 * normale di questo sito (risposte comunque a info@nutrexlab.it) e si annota l'errore.
 */
add_action(
	'wp_mail_failed',
	function ( $error ) {
		if ( empty( $GLOBALS['nutrex_headless_mail_smtp'] ) || ! empty( $GLOBALS['nutrex_headless_mail_plain'] ) ) {
			return;
		}
		$GLOBALS['nutrex_headless_mail_smtp'] = false;
		update_option(
			'nutrex_headless_smtp_error',
			array(
				'time'    => time(),
				'message' => wp_strip_all_tags( $error->get_error_message() ),
			),
			false
		);
		if ( 'test' === $GLOBALS['nutrex_headless_mail'] ) {
			return; // la prova deve mostrare l'errore, non nasconderlo
		}
		$data = $error->get_error_data();
		if ( ! is_array( $data ) || empty( $data['to'] ) ) {
			return;
		}
		// (wp_mail ha gia' tolto dagli header Reply-To, From e tipo: si rimettono quelli che servono)
		$headers = array();
		foreach ( (array) ( $data['headers'] ?? array() ) as $name => $value ) {
			$headers[] = is_string( $name ) ? "$name: $value" : $value;
		}
		$reply = nutrex_headless_sender_address();
		if ( $reply ) {
			$headers[] = 'Reply-To: Nutrex Lab <' . $reply . '>';
		}
		$headers[] = 'Content-Type: text/html; charset=UTF-8';
		$GLOBALS['nutrex_headless_mail_plain']   = true;
		$GLOBALS['nutrex_headless_mail_rescued'] = wp_mail( $data['to'], $data['subject'], $data['message'], $headers, $data['attachments'] ?? array() );
		$GLOBALS['nutrex_headless_mail_plain']   = false;
	}
);

/**
 * Invia un'email Nutrex (HTML) fuori da WooCommerce: modulo contatti, prova delle impostazioni.
 * Mittente "Nutrex Lab" <info@nutrexlab.it> dal server di posta di nutrexlab.it, se impostato.
 */
function nutrex_headless_send( $to, $subject, $html, $headers = array(), $context = 'contact' ) {
	$from      = nutrex_headless_sender_address();
	$set_from  = function ( $address ) use ( $from ) {
		return empty( $GLOBALS['nutrex_headless_mail_plain'] ) && $from ? $from : $address;
	};
	$set_name  = function () {
		return 'Nutrex Lab';
	};
	$set_type  = function () {
		return 'text/html';
	};
	add_filter( 'wp_mail_from', $set_from, PHP_INT_MAX );
	add_filter( 'wp_mail_from_name', $set_name, PHP_INT_MAX );
	add_filter( 'wp_mail_content_type', $set_type, PHP_INT_MAX );
	$GLOBALS['nutrex_headless_mail']         = $context;
	$GLOBALS['nutrex_headless_mail_rescued'] = false;
	// (se il server di posta non risponde e l'invio di riserva va a buon fine, il messaggio e' partito)
	$sent                                    = wp_mail( $to, $subject, $html, $headers ) || ! empty( $GLOBALS['nutrex_headless_mail_rescued'] );
	$GLOBALS['nutrex_headless_mail']         = '';
	remove_filter( 'wp_mail_from', $set_from, PHP_INT_MAX );
	remove_filter( 'wp_mail_from_name', $set_name, PHP_INT_MAX );
	remove_filter( 'wp_mail_content_type', $set_type, PHP_INT_MAX );
	return $sent;
}

// ---------------------------------------------------------------------------- password cifrata

/** Chiave per cifrare la password nel database (dalle chiavi segrete di questo WordPress). */
function nutrex_headless_secret_key() {
	return hash( 'sha256', wp_salt( 'auth' ) . '|nutrex-headless-smtp', true );
}

function nutrex_headless_secret_write( $plain ) {
	$plain = (string) $plain;
	if ( '' === $plain ) {
		return '';
	}
	if ( ! function_exists( 'openssl_encrypt' ) ) {
		return 'raw:' . base64_encode( $plain ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}
	$iv     = random_bytes( 16 );
	$cipher = openssl_encrypt( $plain, 'aes-256-cbc', nutrex_headless_secret_key(), OPENSSL_RAW_DATA, $iv );
	return 'enc1:' . base64_encode( $iv . $cipher ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

function nutrex_headless_secret_read( $stored ) {
	$stored = (string) $stored;
	if ( 0 === strpos( $stored, 'enc1:' ) && function_exists( 'openssl_decrypt' ) ) {
		$raw   = base64_decode( substr( $stored, 5 ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$plain = openssl_decrypt( substr( $raw, 16 ), 'aes-256-cbc', nutrex_headless_secret_key(), OPENSSL_RAW_DATA, substr( $raw, 0, 16 ) );
		return false === $plain ? '' : $plain;
	}
	if ( 0 === strpos( $stored, 'raw:' ) ) {
		return (string) base64_decode( substr( $stored, 4 ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	}
	return $stored;
}

// ---------------------------------------------------------------------------- prova dalle impostazioni

add_action(
	'admin_post_nutrex_headless_test_email',
	function () {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'Permesso negato.', 'nutrex-headless' ) );
		}
		check_admin_referer( 'nutrex_headless_test_email' );
		$to   = nutrex_headless_contact_address();
		$smtp = nutrex_headless_smtp();
		if ( ! $smtp ) {
			$result = array( 'ok' => false, 'message' => __( 'Inserisci e salva la password della casella email prima della prova.', 'nutrex-headless' ) );
		} else {
			delete_option( 'nutrex_headless_smtp_error' );
			$html = nutrex_headless_mail_document(
				array(
					'title'     => 'Prova di invio',
					'preheader' => 'Le email di Nutrex Lab partono da ' . $smtp['user'],
					'body'      => nutrex_headless_mail_hero( 'Prova di invio', 'Funziona.', array( 'Questa email è partita dal server di posta di nutrexlab.it con la casella ' . esc_html( $smtp['user'] ) . '. Le conferme degli ordini Nutrex e i messaggi del modulo contatti partiranno così.' ) ),
				)
			);
			$ok     = nutrex_headless_send( $to, 'Prova di invio · Nutrex Lab', $html, array(), 'test' );
			$error  = get_option( 'nutrex_headless_smtp_error' );
			$result = $ok
				? array( 'ok' => true, 'message' => sprintf( __( 'Email di prova inviata a %s dal server di posta di nutrexlab.it.', 'nutrex-headless' ), $to ) )
				: array( 'ok' => false, 'message' => sprintf( __( 'Invio non riuscito: %s', 'nutrex-headless' ), $error['message'] ?? __( 'errore sconosciuto', 'nutrex-headless' ) ) );
		}
		set_transient( 'nutrex_headless_test_' . get_current_user_id(), $result, 120 );
		wp_safe_redirect( admin_url( 'admin.php?page=wc-settings&tab=advanced&section=nutrex' ) );
		exit;
	}
);
