<?php
/**
 * Email degli ordini con prodotti Nutrex (WooCommerce condiviso con un altro marchio): mittente
 * "Nutrex Lab" <info@nutrexlab.it> (dal server di posta di nutrexlab.it, vedi mail.php) e il design di
 * Nutrex Lab (templates/emails): logo, apertura con titolo, riepilogo con le immagini dei prodotti,
 * indirizzi, aiuto e dati dell'azienda. Le notifiche all'amministratore vanno a Nutrex Lab (separation.php).
 * Le email degli altri ordini e del resto del sito non cambiano.
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

/** Il cliente registrato da Nutrex Lab di cui parla l'email (nuovo account, nuova password), se c'e'. */
function nutrex_headless_email_user( $email ) {
	if ( ! $email instanceof WC_Email || ! $email->object instanceof WP_User ) {
		return null;
	}
	return get_user_meta( $email->object->ID, 'nutrex_headless_customer', true ) ? $email->object : null;
}

/** L'email e' di Nutrex Lab: parla di un ordine Nutrex o di un cliente registrato da Nutrex Lab. */
function nutrex_headless_email_nutrex( $email ) {
	return nutrex_headless_email_order( $email ) || nutrex_headless_email_user( $email );
}

/** Nome del mittente e del sito nelle email Nutrex. */
function nutrex_headless_email_name() {
	$custom = trim( (string) get_option( 'nutrex_headless_email_from_name', '' ) );
	if ( $custom ) {
		return $custom;
	}
	return 'Nutrex Lab';
}

add_filter(
	'woocommerce_email_from_name',
	function ( $name, $email ) {
		$custom = nutrex_headless_email_name();
		return $custom && nutrex_headless_email_nutrex( $email ) ? $custom : $name;
	},
	10,
	2
);

// mittente info@nutrexlab.it (tranne nell'invio di riserva senza SMTP, vedi mail.php)
add_filter(
	'woocommerce_email_from_address',
	function ( $address, $email ) {
		$custom = nutrex_headless_sender_address();
		if ( ! $custom || ! empty( $GLOBALS['nutrex_headless_mail_plain'] ) || ! nutrex_headless_email_nutrex( $email ) ) {
			return $address;
		}
		return $custom;
	},
	10,
	2
);

// nome e indirizzo del sito (oggetto, titolo, testi): Nutrex Lab e nutrexlab.it negli ordini Nutrex
add_filter(
	'woocommerce_email_format_string',
	function ( $string, $email ) {
		$custom = nutrex_headless_email_name();
		if ( ! $custom || ! nutrex_headless_email_nutrex( $email ) ) {
			return $string;
		}
		$site = wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES );
		if ( $site ) {
			$string = str_replace( $site, $custom, $string );
		}
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		if ( $host ) {
			$string = str_replace( $host, nutrex_headless_mail_brand()['host'], $string );
		}
		return $string;
	},
	10,
	2
);

// il logo delle email di WooCommerce porta a nutrexlab.it (WooCommerce 10.7+)
add_filter(
	'woocommerce_email_header_image_url',
	function ( $url ) {
		return ! empty( $GLOBALS['nutrex_headless_email_look'] ) ? nutrex_headless_shop_url() : $url;
	}
);

/*
  Aspetto Nutrex: dall'intestazione fino all'invio, i modelli, gli stili e le impostazioni email di
  WooCommerce (logo, colore, pie' di pagina, nome del sito) diventano quelli di Nutrex Lab.
*/
$GLOBALS['nutrex_headless_email_look'] = false;

add_action(
	'woocommerce_email_header',
	function ( $heading, $email = null ) {
		$GLOBALS['nutrex_headless_email_look']  = (bool) nutrex_headless_email_nutrex( $email );
		$GLOBALS['nutrex_headless_account_mail'] = (bool) nutrex_headless_email_user( $email ); // (i link dell'account portano all'area clienti Nutrex)
		$GLOBALS['nutrex_headless_email_which'] = $email instanceof WC_Email ? $email : null; // (la chiusura non sempre lo riceve)
	},
	1,
	2
);

$nutrex_headless_email_done = function ( $value = null ) {
	$GLOBALS['nutrex_headless_email_look']   = false;
	$GLOBALS['nutrex_headless_account_mail'] = false;
	return $value;
};
add_filter( 'woocommerce_mail_content', $nutrex_headless_email_done, PHP_INT_MAX ); // email pronta (stili compresi)
add_action( 'woocommerce_email_sent', $nutrex_headless_email_done );

/** Valore Nutrex di un'impostazione mentre si scrive un'email Nutrex (altrimenti quello del sito). */
function nutrex_headless_email_option( $value, $nutrex ) {
	return empty( $GLOBALS['nutrex_headless_email_look'] ) ? $value : $nutrex();
}
add_filter( 'option_woocommerce_email_header_image', fn( $v ) => nutrex_headless_email_option( $v, fn() => nutrex_headless_mail_brand()['logo'] ) );
add_filter( 'option_woocommerce_email_base_color', fn( $v ) => nutrex_headless_email_option( $v, fn() => NUTREX_HEADLESS_MAIL['berry'] ) );
add_filter( 'option_woocommerce_email_footer_text', fn( $v ) => nutrex_headless_email_option( $v, fn() => 'Nutrex Lab' ) );
add_filter( 'option_blogname', fn( $v ) => nutrex_headless_email_option( $v, fn() => nutrex_headless_email_name() ?: $v ) );

// ---------------------------------------------------------------------------- modelli Nutrex

/** Corpi delle email al cliente che hanno la versione Nutrex (templates/emails/nutrex-order.php). */
function nutrex_headless_email_bodies() {
	return array(
		'emails/customer-processing-order.php',
		'emails/customer-on-hold-order.php',
		'emails/customer-completed-order.php',
		'emails/customer-invoice.php',
		'emails/customer-note.php',
		'emails/customer-refunded-order.php',
		'emails/customer-cancelled-order.php',
		'emails/customer-failed-order.php',
	);
}

add_filter(
	'wc_get_template',
	function ( $template, $template_name, $args ) {
		$dir = dirname( NUTREX_HEADLESS_FILE ) . '/templates/';
		// corpo dell'email al cliente: se l'ordine e' Nutrex (l'intestazione non e' ancora partita)
		if ( in_array( $template_name, nutrex_headless_email_bodies(), true ) ) {
			$order = $args['order'] ?? null;
			$email = $args['email'] ?? null;
			return $email instanceof WC_Email && nutrex_headless_is_order( $order ) ? $dir . 'emails/nutrex-order.php' : $template;
		}
		// email dell'account (nuovo account, nuova password) ai clienti registrati da Nutrex Lab
		if ( in_array( $template_name, array( 'emails/customer-new-account.php', 'emails/customer-reset-password.php' ), true ) && nutrex_headless_email_user( $args['email'] ?? null ) ) {
			return $dir . 'emails/nutrex-account.php';
		}
		// cornice e parti comuni: mentre si scrive un'email Nutrex (anche quelle per l'amministratore)
		$parts = array( 'emails/email-header.php', 'emails/email-footer.php', 'emails/email-order-details.php', 'emails/email-order-items.php', 'emails/email-addresses.php' );
		if ( in_array( $template_name, $parts, true ) && ! empty( $GLOBALS['nutrex_headless_email_look'] ) ) {
			return $dir . $template_name;
		}
		return $template;
	},
	20,
	3
);

/*
 * Stili per le parti scritte da WooCommerce o da altri plugin dentro le email Nutrex (istruzioni del
 * bonifico, testi delle email all'amministratore): WooCommerce li applica agli elementi.
 */
add_filter(
	'woocommerce_email_styles',
	function ( $css ) {
		if ( empty( $GLOBALS['nutrex_headless_email_look'] ) ) {
			return $css;
		}
		$c = NUTREX_HEADLESS_MAIL;
		$f = $c['font'];
		return "
			p { margin: 0 0 14px; font-family: $f; font-size: 15px; line-height: 1.6; color: {$c['text']}; }
			h2 { margin: 26px 0 12px; font-family: $f; font-size: 18px; line-height: 1.3; font-weight: 800; color: {$c['ink']}; }
			h3 { margin: 16px 0 8px; font-family: $f; font-size: 15px; font-weight: 700; color: {$c['ink']}; }
			a { color: {$c['berry']}; }
			ul { margin: 0 0 16px; padding: 0 0 0 18px; font-family: $f; font-size: 14px; line-height: 1.7; color: {$c['text']}; }
			li strong { color: {$c['ink']}; }
			small, .includes_tax, .shipped_via { font-size: 12px; font-weight: 400; color: {$c['muted']}; }
			del { color: {$c['muted']}; }
			.woocommerce-bacs-bank-details, .wc-bacs-bank-details { margin: 22px 0 0; padding: 18px 22px; background: {$c['soft']}; border-radius: 14px; }
			.wc-bacs-bank-details-heading { margin-top: 0; }
			blockquote { margin: 0 0 16px; padding: 14px 18px; border-left: 3px solid {$c['berry']}; background: {$c['soft']}; }
			.td, table.td, th.td, td.td { font-family: $f; color: {$c['text']}; border-color: {$c['line']}; }
		";
	},
	PHP_INT_MAX
);

// ---------------------------------------------------------------------------- testi

/**
 * Apertura dell'email al cliente per il tipo di email: soprattitolo, titolo, paragrafi, pulsante,
 * nota e testo di anteprima (quello che il programma di posta mostra sotto l'oggetto).
 */
function nutrex_headless_email_copy( $email, $order, $vars ) {
	$first  = trim( (string) $order->get_billing_first_name() );
	$number = '<strong>n. ' . esc_html( $order->get_order_number() ) . '</strong>';
	$plain  = 'n. ' . $order->get_order_number();
	$total  = html_entity_decode( wp_strip_all_tags( wc_price( $order->get_total(), array( 'currency' => $order->get_currency() ) ) ), ENT_QUOTES, 'UTF-8' );
	$thanks = $first ? sprintf( 'Grazie, %s.', $first ) : 'Grazie per il tuo ordine.';
	$hello  = $first ? sprintf( 'Ciao %s,', $first ) : 'Ciao,';
	$site   = nutrex_headless_mail_brand()['site'];

	$copy = array(
		'eyebrow'   => 'Il tuo ordine',
		'title'     => $thanks,
		'lines'     => array( sprintf( 'Qui sotto trovi il riepilogo del tuo ordine %s.', $number ) ),
		'button'    => null,
		'note'      => '',
		'preheader' => sprintf( 'Ordine %s · Totale %s', $plain, $total ),
	);

	switch ( $email instanceof WC_Email ? $email->id : '' ) {
		case 'customer_processing_order':
			$copy['eyebrow']   = 'Ordine confermato';
			$copy['lines']     = array( sprintf( 'Abbiamo ricevuto il tuo ordine %s e lo stiamo preparando con cura.', $number ), 'Qui sotto trovi il riepilogo con tutti i dettagli.' );
			$copy['preheader'] = sprintf( 'Ordine %s confermato · Totale %s', $plain, $total );
			break;

		case 'customer_on_hold_order':
			$copy['eyebrow'] = 'Ordine ricevuto';
			$copy['lines']   = array( sprintf( 'Abbiamo ricevuto il tuo ordine %s: lo prepariamo appena confermiamo il pagamento.', $number ) );
			if ( in_array( $order->get_payment_method(), array( 'bacs', 'cheque' ), true ) ) {
				$copy['lines'][] = 'Qui sotto trovi i dati per completare il pagamento.';
			}
			$copy['preheader'] = sprintf( 'Ordine %s ricevuto · in attesa del pagamento', $plain );
			break;

		case 'customer_completed_order':
			$copy['eyebrow']   = 'Ordine completato';
			$copy['lines']     = array( sprintf( 'Abbiamo completato il tuo ordine %s.', $number ), 'Grazie per aver scelto Nutrex Lab.' );
			$copy['preheader'] = sprintf( 'Ordine %s completato', $plain );
			break;

		case 'customer_invoice':
			if ( $order->needs_payment() ) {
				$failed            = $order->has_status( 'failed' );
				$copy['eyebrow']   = $failed ? 'Pagamento non riuscito' : 'Pagamento';
				$copy['title']     = $failed ? 'Riprova il pagamento.' : 'Il tuo ordine ti aspetta.';
				$copy['lines']     = array(
					$failed
						? sprintf( 'Il pagamento dell\'ordine %s non è andato a buon fine: puoi riprovare quando vuoi.', $number )
						: sprintf( 'L\'ordine %s è pronto: puoi completare il pagamento quando vuoi.', $number ),
				);
				$copy['button']    = array(
					'label' => 'Paga l\'ordine',
					'url'   => $order->get_checkout_payment_url(),
				);
				$copy['preheader'] = sprintf( 'Ordine %s · da pagare %s', $plain, $total );
			} else {
				$copy['eyebrow'] = 'Dettagli dell\'ordine';
				$copy['title']   = 'Ecco il tuo ordine.';
			}
			break;

		case 'customer_note':
			$copy['eyebrow']   = 'Aggiornamento sull\'ordine';
			$copy['title']     = $hello;
			$copy['lines']     = array( sprintf( 'Abbiamo aggiunto una nota al tuo ordine %s:', $number ) );
			$copy['note']      = (string) ( $vars['customer_note'] ?? '' );
			$copy['preheader'] = sprintf( 'Una nota sul tuo ordine %s', $plain );
			break;

		case 'customer_refunded_order':
			$partial           = ! empty( $vars['partial_refund'] );
			$copy['eyebrow']   = $partial ? 'Rimborso parziale' : 'Rimborso';
			$copy['title']     = 'Rimborso in arrivo.';
			$copy['lines']     = array(
				sprintf( $partial ? 'Abbiamo rimborsato in parte il tuo ordine %s.' : 'Abbiamo rimborsato il tuo ordine %s.', $number ),
				'L\'importo torna sul metodo di pagamento che hai usato: i tempi di accredito dipendono dalla tua banca o dal circuito di pagamento.',
			);
			$copy['preheader'] = sprintf( 'Rimborso per l\'ordine %s', $plain );
			break;

		case 'customer_cancelled_order':
			$copy['eyebrow']   = 'Ordine annullato';
			$copy['title']     = 'Ordine annullato.';
			$copy['lines']     = array( sprintf( 'Il tuo ordine %s è stato annullato.', $number ), 'Se non te lo aspettavi, rispondi a questa email: verifichiamo subito.' );
			$copy['preheader'] = sprintf( 'Ordine %s annullato', $plain );
			break;

		case 'customer_failed_order':
			$copy['eyebrow']   = 'Pagamento non riuscito';
			$copy['title']     = 'Il pagamento non è andato.';
			$copy['lines']     = array( sprintf( 'Non siamo riusciti a completare il pagamento dell\'ordine %s.', $number ), 'Puoi riprovare dal negozio, anche con un altro metodo di pagamento.' );
			$copy['button']    = array(
				'label' => 'Torna al negozio',
				'url'   => $site . '/acquista',
			);
			$copy['preheader'] = sprintf( 'Pagamento non riuscito per l\'ordine %s', $plain );
			break;
	}

	return apply_filters( 'nutrex_headless_email_copy', $copy, $email, $order );
}
