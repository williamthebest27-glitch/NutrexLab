<?php
/**
 * Area clienti di Nutrex Lab: la pagina /account-nutrex-lab/ di questo WooCommerce (creata dal plugin,
 * con la cornice Nutrex), con le stesse funzioni dell'area clienti del sito ospite ma separata:
 * - accesso e registrazione (nome, cognome, email, password e conferma, codice amico, privacy);
 * - sconto del 5% sul primo ordine Nutrex di chi si registra, applicato da solo al pagamento;
 * - invita un amico: ogni account ha un codice NX-XXXXX e un link personale (nutrexlab.it/account?ref=...).
 *   Per ogni amico che si registra, chi l'ha invitato riceve subito un bonus del 5%: un codice monouso,
 *   valido solo sui prodotti Nutrex, uno per ordine (gli altri restano);
 * - dashboard con i vantaggi, il link da condividere e i risultati; ordini (solo quelli Nutrex),
 *   indirizzi e dati dell'account;
 * - i vantaggi del sito ospite non valgono sui carrelli Nutrex e quelli Nutrex non valgono sugli altri;
 *   gli ordini Nutrex non compaiono nell'area clienti del sito ospite.
 * L'account (email e password) e' uno solo per i due negozi: e' lo stesso WordPress.
 * Sconti e bonus sono codici promozionali di WooCommerce: compaiono nell'ordine come righe di sconto e
 * si sommano alle offerte quantita' (si calcolano sui prezzi gia' scontati).
 */

defined( 'ABSPATH' ) || exit;

/** Regole dell'area clienti (filtrabili con nutrex_headless_account_config). */
function nutrex_headless_account_config() {
	static $c = null;
	if ( null === $c ) {
		$c = apply_filters(
			'nutrex_headless_account_config',
			array(
				'sconto_membri' => 5,               // % sul primo ordine Nutrex di chi si registra
				'bonus_amico'   => 5,               // % di ogni bonus amico, uno per ordine
				'coupon_membri' => 'membri-nutrex', // codice virtuale dello sconto sul primo ordine
				'prefisso'      => 'NX-',
				'giorni_invito' => 30,              // quanto resta ricordato un invito
			)
		);
	}
	return $c;
}

function nutrex_headless_pct( $numero ) {
	$numero = (float) $numero;
	return floor( $numero ) == $numero ? number_format_i18n( $numero, 0 ) : number_format_i18n( $numero, 1 ); // phpcs:ignore Universal.Operators.StrictComparisons.LooseEqual
}

// ---------------------------------------------------------------------------- la pagina

/** Id della pagina dell'area clienti Nutrex (0 se non c'e'). */
function nutrex_headless_account_page_id() {
	$id   = absint( get_option( 'nutrex_headless_account_page', 0 ) );
	$page = $id ? get_post( $id ) : null;
	return $page && 'page' === $page->post_type && 'publish' === $page->post_status ? $id : 0;
}

/** Crea la pagina se manca (o se e' stata cestinata). */
function nutrex_headless_ensure_account_page() {
	$id = nutrex_headless_account_page_id();
	if ( $id ) {
		return $id;
	}
	$menu = has_action( 'transition_post_status', '_wp_auto_add_pages_to_menu' );
	if ( false !== $menu ) {
		remove_action( 'transition_post_status', '_wp_auto_add_pages_to_menu', $menu );
	}
	$id = wp_insert_post(
		array(
			'post_type'      => 'page',
			'post_status'    => 'publish',
			'post_title'     => 'Account Nutrex Lab',
			'post_name'      => 'account-nutrex-lab',
			'post_content'   => "<!-- wp:shortcode -->\n[woocommerce_my_account]\n<!-- /wp:shortcode -->",
			'comment_status' => 'closed',
			'ping_status'    => 'closed',
		)
	);
	if ( false !== $menu ) {
		add_action( 'transition_post_status', '_wp_auto_add_pages_to_menu', $menu, 3 );
	}
	if ( ! $id || is_wp_error( $id ) ) {
		return 0;
	}
	update_option( 'nutrex_headless_account_page', $id, true );
	return $id;
}

add_action(
	'admin_init',
	function () {
		if ( current_user_can( 'manage_woocommerce' ) && nutrex_headless_category_ids() && ! nutrex_headless_account_page_id() ) {
			nutrex_headless_ensure_account_page();
		}
	}
);

// il primo cliente che apre /account-nutrex-lab/ prima che un amministratore sia entrato in bacheca: la pagina nasce al volo
add_action(
	'template_redirect',
	function () {
		if ( ! is_404() || ! nutrex_headless_category_ids() || nutrex_headless_account_page_id() ) {
			return;
		}
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		if ( ! preg_match( '#^(/[^/?]+)*/account-nutrex-lab/?(\?|$)#', $uri ) ) {
			return;
		}
		$id = nutrex_headless_ensure_account_page();
		if ( $id ) {
			wp_safe_redirect( add_query_arg( rawurlencode_deep( wp_unslash( $_GET ) ), get_permalink( $id ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			exit;
		}
	},
	0
);

/** Indirizzo dell'area clienti Nutrex (con eventuali parametri). */
function nutrex_headless_account_url( $args = array() ) {
	$id  = nutrex_headless_ensure_account_page();
	$url = $id ? get_permalink( $id ) : wc_get_page_permalink( 'myaccount' );
	return $args ? add_query_arg( $args, $url ) : $url;
}

/** La richiesta e' la pagina dell'area clienti Nutrex (anche i suoi endpoint: ordini, indirizzi...)? */
function nutrex_headless_on_account_page() {
	static $on = null;
	if ( null !== $on ) {
		return $on;
	}
	if ( ! did_action( 'wp' ) ) {
		return false;
	}
	$id = nutrex_headless_account_page_id();
	$on = $id && is_page( $id );
	return $on;
}

/**
 * La richiesta riguarda l'area clienti Nutrex: la pagina, un modulo spedito da li' (accesso,
 * registrazione, password: WooCommerce li elabora prima di sapere che pagina e') o un'email a un
 * cliente Nutrex in preparazione.
 */
function nutrex_headless_account_request() {
	if ( ! empty( $GLOBALS['nutrex_headless_account_mail'] ) || ! empty( $_POST['nutrex_account'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
		return true;
	}
	if ( did_action( 'wp' ) ) {
		return nutrex_headless_on_account_page();
	}
	$id = nutrex_headless_account_page_id();
	if ( ! $id ) {
		return false;
	}
	$path = wp_parse_url( get_permalink( $id ), PHP_URL_PATH );
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	return $path && 0 === strpos( $uri, untrailingslashit( $path ) );
}

// su questa pagina e' lei "Il mio account" di WooCommerce: link degli endpoint, ritorno dopo l'accesso
add_filter(
	'woocommerce_get_myaccount_page_id',
	function ( $id ) {
		return nutrex_headless_account_request() ? nutrex_headless_account_page_id() : $id;
	}
);

// registrazione accesa, nome utente dall'email, password scelta dal cliente (solo per l'area Nutrex)
foreach (
	array(
		'woocommerce_enable_myaccount_registration'    => 'yes',
		'woocommerce_registration_generate_username'   => 'yes',
		'woocommerce_registration_generate_password'   => 'no',
		'woocommerce_enable_checkout_login_reminder'   => 'yes',
	) as $nutrex_headless_option => $nutrex_headless_value
) {
	add_filter(
		'pre_option_' . $nutrex_headless_option,
		function ( $pre ) use ( $nutrex_headless_value ) {
			return nutrex_headless_account_request() ? $nutrex_headless_value : $pre;
		}
	);
}

add_action(
	'template_redirect',
	function () {
		global $wp;
		if ( ! nutrex_headless_on_account_page() ) {
			return;
		}
		nocache_headers();
		// l'invito dal link: si ricorda in un cookie (vince il primo); chi ha gia' un account non e' un amico
		if ( ! empty( $_GET['ref'] ) && ! is_user_logged_in() && empty( $_COOKIE['nutrex_ref'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$codice = nutrex_headless_pulisci_codice( wp_unslash( $_GET['ref'] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Recommended
			$da     = nutrex_headless_utente_da_codice( $codice );
			if ( $da ) {
				nutrex_headless_cookie_invito( $codice, (int) nutrex_headless_account_config()['giorni_invito'] );
				if ( ! nutrex_headless_e_robot() ) {
					update_user_meta( $da, 'nutrex_headless_visite', (int) get_user_meta( $da, 'nutrex_headless_visite', true ) + 1 );
				}
				$_COOKIE['nutrex_ref'] = $codice;
			}
		}
		// un ordine del sito ospite aperto da qui: alla sua area clienti
		$view = absint( $wp->query_vars['view-order'] ?? 0 );
		if ( $view ) {
			$order = wc_get_order( $view );
			if ( $order && ! nutrex_headless_is_order( $order ) ) {
				wp_safe_redirect( wc_get_endpoint_url( 'view-order', $view, get_permalink( (int) get_option( 'woocommerce_myaccount_page_id' ) ) ) );
				exit;
			}
		}
	},
	1
);

// un ordine Nutrex aperto dall'area clienti del sito ospite: alla pagina Nutrex
add_action(
	'template_redirect',
	function () {
		global $wp;
		$host = (int) get_option( 'woocommerce_myaccount_page_id' );
		if ( ! $host || ! nutrex_headless_account_page_id() || nutrex_headless_on_account_page() || ! is_page( $host ) ) {
			return;
		}
		$view = absint( $wp->query_vars['view-order'] ?? 0 );
		if ( $view ) {
			$order = wc_get_order( $view );
			if ( $order && nutrex_headless_is_order( $order ) ) {
				wp_safe_redirect( wc_get_endpoint_url( 'view-order', $view, nutrex_headless_account_url() ) );
				exit;
			}
		}
	},
	1
);

// dopo l'accesso o la registrazione dall'area Nutrex: la pagina Nutrex (o dove si era: pagamento, carrello)
function nutrex_headless_account_redirect( $redirect ) {
	if ( ! nutrex_headless_account_request() ) {
		return $redirect;
	}
	$torna = isset( $_REQUEST['torna'] ) ? sanitize_key( wp_unslash( $_REQUEST['torna'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( 'pagamento' === $torna && nutrex_headless_checkout_page_id() ) {
		return get_permalink( nutrex_headless_checkout_page_id() );
	}
	if ( 'carrello' === $torna ) {
		return nutrex_headless_shop_url( '/carrello' );
	}
	return nutrex_headless_account_url();
}
add_filter( 'woocommerce_login_redirect', 'nutrex_headless_account_redirect', 20 );
add_filter( 'woocommerce_registration_redirect', 'nutrex_headless_account_redirect', 20 );

// ---------------------------------------------------------------------------- fuori da menu, ricerche e mappe

add_filter(
	'display_post_states',
	function ( $states, $post ) {
		if ( $post->ID && nutrex_headless_account_page_id() === $post->ID ) {
			$states['nutrex_headless_account'] = __( 'Area clienti Nutrex Lab, usata dal plugin: non modificarla', 'nutrex-headless' );
		}
		return $states;
	},
	10,
	2
);

add_filter(
	'wp_robots',
	function ( $robots ) {
		if ( nutrex_headless_on_account_page() ) {
			$robots['noindex']  = true;
			$robots['nofollow'] = true;
		}
		return $robots;
	}
);

add_filter(
	'wp_sitemaps_posts_query_args',
	function ( $args, $post_type ) {
		$id = nutrex_headless_account_page_id();
		if ( 'page' === $post_type && $id ) {
			$args['post__not_in'] = array_merge( (array) ( $args['post__not_in'] ?? array() ), array( $id ) ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in
		}
		return $args;
	},
	10,
	2
);

foreach ( array( 'wpseo_exclude_from_sitemap_by_post_ids', 'wp_list_pages_excludes' ) as $nutrex_headless_hook ) {
	add_filter(
		$nutrex_headless_hook,
		function ( $ids ) {
			$id = nutrex_headless_account_page_id();
			return $id ? array_merge( (array) $ids, array( $id ) ) : $ids;
		}
	);
}

add_action(
	'pre_get_posts',
	function ( $q ) {
		$id = nutrex_headless_account_page_id();
		if ( $id && ! is_admin() && $q->is_main_query() && $q->is_search() ) {
			$q->set( 'post__not_in', array_merge( (array) $q->get( 'post__not_in' ), array( $id ) ) );
		}
	}
);

// ---------------------------------------------------------------------------- codici e link personali

/** Il codice come lo scrive la gente: " nx 7k92x ", "NX7K92X" o "7K92X" diventano NX-7K92X. */
function nutrex_headless_pulisci_codice( $codice ) {
	$cfg    = nutrex_headless_account_config();
	$pref   = strtoupper( (string) preg_replace( '/[^A-Za-z0-9]/', '', $cfg['prefisso'] ) );
	$pulito = strtoupper( (string) preg_replace( '/[^A-Za-z0-9]/', '', (string) $codice ) );
	if ( 5 === strlen( $pulito ) ) {
		$pulito = $pref . $pulito;
	}
	if ( '' !== $pref && 0 === strpos( $pulito, $pref ) && strlen( $pulito ) === strlen( $pref ) + 5 ) {
		return $cfg['prefisso'] . substr( $pulito, strlen( $pref ) );
	}
	return substr( $pulito, 0, 16 );
}

function nutrex_headless_utente_da_codice( $codice ) {
	$codice = nutrex_headless_pulisci_codice( $codice );
	if ( strlen( $codice ) < 4 ) {
		return 0;
	}
	$ids = get_users(
		array(
			'meta_key'    => 'nutrex_headless_codice', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			'meta_value'  => $codice, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'number'      => 1,
			'fields'      => 'ID',
			'count_total' => false,
		)
	);
	return $ids ? (int) $ids[0] : 0;
}

/** Il codice Nutrex dell'account; se non c'e' ancora lo crea (NX- + 5 caratteri). */
function nutrex_headless_codice( $user_id, $crea = true ) {
	$user_id = (int) $user_id;
	if ( $user_id <= 0 ) {
		return '';
	}
	$codice = (string) get_user_meta( $user_id, 'nutrex_headless_codice', true );
	if ( '' !== $codice || ! $crea ) {
		return $codice;
	}
	$cfg      = nutrex_headless_account_config();
	$alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // niente 0/O, 1/I/L: si leggono male
	for ( $tentativo = 0; $tentativo < 25; $tentativo++ ) {
		$prova = $cfg['prefisso'];
		for ( $i = 0; $i < 5; $i++ ) {
			$prova .= $alfabeto[ random_int( 0, strlen( $alfabeto ) - 1 ) ];
		}
		if ( ! nutrex_headless_utente_da_codice( $prova ) ) {
			update_user_meta( $user_id, 'nutrex_headless_codice', $prova );
			return $prova;
		}
	}
	return '';
}

/** Il link personale: su nutrexlab.it, che porta all'area clienti con il codice gia' scritto. */
function nutrex_headless_link_invito( $user_id ) {
	$codice = nutrex_headless_codice( $user_id );
	return $codice ? nutrex_headless_shop_url( '/account?ref=' . rawurlencode( $codice ) ) : '';
}

/** L'email "vera": maiuscole, +etichette e i punti di Gmail non fanno un'email diversa. */
function nutrex_headless_email_base( $email ) {
	$email = strtolower( trim( (string) $email ) );
	if ( false === strpos( $email, '@' ) ) {
		return $email;
	}
	list( $nome, $dominio ) = explode( '@', $email, 2 );
	$nome = preg_replace( '/\+.*$/', '', $nome );
	if ( 'gmail.com' === $dominio || 'googlemail.com' === $dominio ) {
		$nome    = str_replace( '.', '', $nome );
		$dominio = 'gmail.com';
	}
	return $nome . '@' . $dominio;
}

function nutrex_headless_e_robot() {
	$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? (string) $_SERVER['HTTP_USER_AGENT'] : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	return '' === $ua || (bool) preg_match( '/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse/i', $ua );
}

function nutrex_headless_cookie_invito( $codice, $giorni ) {
	if ( headers_sent() ) {
		return;
	}
	setcookie(
		'nutrex_ref',
		$codice,
		array(
			'expires'  => $giorni > 0 ? time() + $giorni * DAY_IN_SECONDS : time() - YEAR_IN_SECONDS,
			'path'     => COOKIEPATH ? COOKIEPATH : '/',
			'domain'   => COOKIE_DOMAIN,
			'secure'   => is_ssl(),
			'httponly' => true,
			'samesite' => 'Lax',
		)
	);
}

/** Il codice d'invito di chi sta guardando: dal modulo, dall'indirizzo o dal cookie. */
function nutrex_headless_codice_invito_corrente() {
	foreach ( array( $_POST, $_GET, $_COOKIE ) as $fonte ) { // phpcs:ignore WordPress.Security.NonceVerification
		foreach ( array( 'nutrex_ref', 'ref' ) as $chiave ) {
			if ( ! empty( $fonte[ $chiave ] ) && is_string( $fonte[ $chiave ] ) ) {
				$codice = nutrex_headless_pulisci_codice( wp_unslash( $fonte[ $chiave ] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
				if ( nutrex_headless_utente_da_codice( $codice ) ) {
					return $codice;
				}
			}
		}
	}
	return '';
}

// ---------------------------------------------------------------------------- registrazione

function nutrex_headless_postato( $chiave ) {
	return isset( $_POST[ $chiave ] ) ? sanitize_text_field( wp_unslash( $_POST[ $chiave ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
}

// in cima al modulo: il vantaggio, poi nome e cognome
add_action(
	'woocommerce_register_form_start',
	function () {
		if ( ! nutrex_headless_on_account_page() ) {
			return;
		}
		$cfg = nutrex_headless_account_config();
		echo '<div class="nxa-vantaggio">'
			. '<span class="nxa-vantaggio__label">Il tuo vantaggio</span>'
			. '<strong class="nxa-vantaggio__num">&minus;' . esc_html( nutrex_headless_pct( $cfg['sconto_membri'] ) ) . '%</strong>'
			. '<span class="nxa-vantaggio__testo">Sul tuo primo ordine: si applica da solo al pagamento.</span>'
			. '</div>';
		if ( nutrex_headless_codice_invito_corrente() ) {
			echo '<p class="nxa-invitato"><span aria-hidden="true">&#10003;</span> Hai ricevuto un invito: registrandoti, chi ti ha invitato riceve un bonus del '
				. esc_html( nutrex_headless_pct( $cfg['bonus_amico'] ) ) . '%.</p>';
		}
		$campi = array(
			'nutrex_nome'    => array( 'Nome', 'given-name', 'form-row-first' ),
			'nutrex_cognome' => array( 'Cognome', 'family-name', 'form-row-last' ),
		);
		foreach ( $campi as $nome => $c ) {
			echo '<p class="woocommerce-form-row form-row ' . esc_attr( $c[2] ) . '">'
				. '<label for="reg_' . esc_attr( $nome ) . '">' . esc_html( $c[0] ) . '&nbsp;<span class="required" aria-hidden="true">*</span></label>'
				. '<input type="text" class="woocommerce-Input woocommerce-Input--text input-text" name="' . esc_attr( $nome ) . '" id="reg_' . esc_attr( $nome ) . '"'
				. ' autocomplete="' . esc_attr( $c[1] ) . '" value="' . esc_attr( nutrex_headless_postato( $nome ) ) . '" required aria-required="true" />'
				. '</p>';
		}
	}
);

// dopo la password: la conferma, il codice amico, la spunta privacy/termini
add_action(
	'woocommerce_register_form',
	function () {
		if ( ! nutrex_headless_on_account_page() ) {
			return;
		}
		$cfg    = nutrex_headless_account_config();
		$codice = isset( $_POST['nutrex_ref'] ) ? sanitize_text_field( wp_unslash( $_POST['nutrex_ref'] ) ) : nutrex_headless_codice_invito_corrente(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		echo '<p class="woocommerce-form-row form-row form-row-wide">'
			. '<label for="reg_nutrex_password2">Conferma password&nbsp;<span class="required" aria-hidden="true">*</span></label>'
			. '<input type="password" class="woocommerce-Input woocommerce-Input--text input-text" name="nutrex_password2" id="reg_nutrex_password2" autocomplete="new-password" required aria-required="true" />'
			. '</p>';
		echo '<p class="woocommerce-form-row form-row form-row-wide nxa-codice-amico">'
			. '<label for="reg_nutrex_ref">Codice amico&nbsp;<span class="optional">(facoltativo)</span></label>'
			. '<input type="text" class="woocommerce-Input woocommerce-Input--text input-text" name="nutrex_ref" id="reg_nutrex_ref"'
			. ' value="' . esc_attr( $codice ) . '" placeholder="' . esc_attr( $cfg['prefisso'] ) . 'XXXXX" maxlength="16"'
			. ' autocomplete="off" autocapitalize="characters" spellcheck="false" />'
			. '<span class="nxa-codice-amico__nota">Chi ti ha dato il codice riceve un bonus del ' . esc_html( nutrex_headless_pct( $cfg['bonus_amico'] ) ) . '% appena ti registri.</span>'
			. '</p>';
		echo '<p class="form-row nxa-privacy">'
			. '<label class="woocommerce-form__label woocommerce-form__label-for-checkbox">'
			. '<input type="checkbox" class="woocommerce-form__input woocommerce-form__input-checkbox" name="nutrex_privacy" value="1"' . checked( ! empty( $_POST['nutrex_privacy'] ), true, false ) . ' required aria-required="true" /> ' // phpcs:ignore WordPress.Security.NonceVerification.Missing
			. '<span>Ho letto e accetto la <a href="' . esc_url( nutrex_headless_shop_url( '/privacy-policy' ) ) . '" target="_blank" rel="noopener">Privacy Policy</a>'
			. ' e i <a href="' . esc_url( nutrex_headless_shop_url( '/termini-e-condizioni' ) ) . '" target="_blank" rel="noopener">Termini e condizioni</a> di Nutrex Lab.'
			. '&nbsp;<span class="required" aria-hidden="true">*</span></span>'
			. '</label></p>';
		echo '<input type="hidden" name="nutrex_account" value="1" />';
		nutrex_headless_campo_torna();
	},
	5
);

/** Da dove si e' arrivati (pagamento, carrello): accesso e registrazione riportano la'. */
function nutrex_headless_campo_torna() {
	$torna = isset( $_GET['torna'] ) ? sanitize_key( wp_unslash( $_GET['torna'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( in_array( $torna, array( 'pagamento', 'carrello' ), true ) ) {
		echo '<input type="hidden" name="torna" value="' . esc_attr( $torna ) . '" />';
	}
}

add_action(
	'woocommerce_login_form',
	function () {
		if ( nutrex_headless_on_account_page() ) {
			echo '<input type="hidden" name="nutrex_account" value="1" />';
			nutrex_headless_campo_torna();
		}
	}
);

add_filter(
	'woocommerce_registration_errors',
	function ( $errori, $username, $email ) {
		if ( empty( $_POST['nutrex_account'] ) || ! $errori instanceof WP_Error ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return $errori;
		}
		$messaggi = array();
		if ( '' === nutrex_headless_postato( 'nutrex_nome' ) ) {
			$messaggi[] = '<strong>Nome</strong>: scrivi il tuo nome.';
		}
		if ( '' === nutrex_headless_postato( 'nutrex_cognome' ) ) {
			$messaggi[] = '<strong>Cognome</strong>: scrivi il tuo cognome.';
		}
		$p1 = isset( $_POST['password'] ) ? (string) wp_unslash( $_POST['password'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$p2 = isset( $_POST['nutrex_password2'] ) ? (string) wp_unslash( $_POST['nutrex_password2'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		if ( $p1 !== $p2 ) {
			$messaggi[] = '<strong>Password</strong>: le due password non coincidono.';
		}
		$scritto = trim( nutrex_headless_postato( 'nutrex_ref' ) );
		if ( '' !== $scritto && ! nutrex_headless_utente_da_codice( $scritto ) ) {
			$messaggi[] = '<strong>Codice amico</strong>: &laquo;' . esc_html( nutrex_headless_pulisci_codice( $scritto ) ) . '&raquo; non esiste. Controllalo, oppure lascia vuoto il campo.';
		}
		if ( empty( $_POST['nutrex_privacy'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			$messaggi[] = 'Per creare l&rsquo;account accetta la <strong>Privacy Policy</strong> e i <strong>Termini e condizioni</strong>.';
		}
		if ( $messaggi ) {
			$errori->add( 'nutrex_registrazione', implode( '<br>', $messaggi ) );
		}
		return $errori;
	},
	10,
	3
);

add_action(
	'woocommerce_created_customer',
	function ( $user_id ) {
		if ( empty( $_POST['nutrex_account'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return; // registrazioni del sito ospite: come sono
		}
		$user_id = (int) $user_id;
		$nome    = nutrex_headless_postato( 'nutrex_nome' );
		$cognome = nutrex_headless_postato( 'nutrex_cognome' );
		wp_update_user(
			array(
				'ID'           => $user_id,
				'first_name'   => $nome,
				'last_name'    => $cognome,
				'display_name' => trim( $nome . ' ' . $cognome ),
			)
		);
		update_user_meta( $user_id, 'billing_first_name', $nome );
		update_user_meta( $user_id, 'billing_last_name', $cognome );
		update_user_meta( $user_id, 'nutrex_headless_customer', current_time( 'mysql' ) ); // cliente registrato da Nutrex Lab
		update_user_meta( $user_id, 'nutrex_headless_privacy', current_time( 'mysql' ) );
		update_user_meta( $user_id, 'nutrex_headless_benvenuto', 1 );
		nutrex_headless_codice( $user_id );
		$invito = nutrex_headless_pulisci_codice( nutrex_headless_postato( 'nutrex_ref' ) );
		if ( '' !== $invito && nutrex_headless_utente_da_codice( $invito ) ) {
			// il bonus va a chi ha invitato, subito, alla registrazione dell'amico
			if ( nutrex_headless_associa_invito( $user_id, $invito ) ) {
				nutrex_headless_invito_valido( $user_id );
			}
		}
		nutrex_headless_cookie_invito( '', 0 );
	},
	10,
	1
);

/** Un account viene associato una volta sola, e mai a se stesso. */
function nutrex_headless_associa_invito( $user_id, $codice ) {
	$user_id = (int) $user_id;
	if ( get_user_meta( $user_id, 'nutrex_headless_invitato_da', true ) ) {
		return false;
	}
	$da = nutrex_headless_utente_da_codice( $codice );
	if ( ! $da || $da === $user_id ) {
		return false;
	}
	$nuovo = get_userdata( $user_id );
	$amico = get_userdata( $da );
	if ( ! $nuovo || ! $amico ) {
		return false;
	}
	$stato       = 'registrato';
	$motivo      = '';
	$email_amico = array_filter( array( nutrex_headless_email_base( $amico->user_email ), nutrex_headless_email_base( get_user_meta( $da, 'billing_email', true ) ) ) );
	if ( in_array( nutrex_headless_email_base( $nuovo->user_email ), $email_amico, true ) ) {
		$stato  = 'non valido';
		$motivo = 'stessa email di chi ha invitato';
	} elseif ( nutrex_headless_era_gia_cliente( $nuovo->user_email ) ) {
		$stato  = 'non valido';
		$motivo = 'era gia\' cliente Nutrex prima dell\'invito';
	}
	update_user_meta( $user_id, 'nutrex_headless_invitato_da', $da );
	update_user_meta( $user_id, 'nutrex_headless_invito_codice', nutrex_headless_pulisci_codice( $codice ) );
	update_user_meta( $user_id, 'nutrex_headless_invito_data', current_time( 'mysql' ) );
	update_user_meta( $user_id, 'nutrex_headless_invito_stato', $stato );
	if ( $motivo ) {
		update_user_meta( $user_id, 'nutrex_headless_invito_motivo', $motivo );
	}
	return true;
}

/** Ha gia' comprato da Nutrex Lab (anche da ospite)? */
function nutrex_headless_era_gia_cliente( $email ) {
	if ( ! is_email( $email ) ) {
		return false;
	}
	$ordini = wc_get_orders(
		array(
			'billing_email' => $email,
			'status'        => array( 'wc-processing', 'wc-completed' ),
			'limit'         => 20,
		)
	);
	foreach ( $ordini as $ordine ) {
		if ( nutrex_headless_is_order( $ordine ) ) {
			return true;
		}
	}
	return false;
}

/** L'invito diventa valido e chi ha invitato riceve il suo bonus (una volta sola per amico). */
function nutrex_headless_invito_valido( $cliente ) {
	$cliente = (int) $cliente;
	if ( 'registrato' !== get_user_meta( $cliente, 'nutrex_headless_invito_stato', true ) ) {
		return false;
	}
	$da = (int) get_user_meta( $cliente, 'nutrex_headless_invitato_da', true );
	if ( ! $da || ! get_userdata( $da ) ) {
		update_user_meta( $cliente, 'nutrex_headless_invito_stato', 'non valido' );
		update_user_meta( $cliente, 'nutrex_headless_invito_motivo', 'l\'account di chi ha invitato non c\'e\' piu\'' );
		return false;
	}
	update_user_meta( $cliente, 'nutrex_headless_invito_stato', 'valido' );
	update_user_meta( $cliente, 'nutrex_headless_invito_valido_il', current_time( 'mysql' ) );
	nutrex_headless_crea_bonus( $da, $cliente );
	return true;
}

// ---------------------------------------------------------------------------- gli sconti (codici promozionali)

/** Il primo ordine Nutrex e' ancora da fare? Contano gli ordini Nutrex da registrato: pagati, in attesa di bonifico, completati o rimborsati. */
function nutrex_headless_primo_ordine_libero( $user_id ) {
	$user_id = (int) $user_id;
	$utente  = $user_id > 0 ? get_userdata( $user_id ) : false;
	if ( ! $utente ) {
		return false;
	}
	$args = array(
		'customer_id' => $user_id,
		'status'      => array( 'wc-processing', 'wc-completed', 'wc-on-hold', 'wc-refunded' ),
		'limit'       => 50,
	);
	$da   = strtotime( $utente->user_registered . ' UTC' );
	if ( $da ) {
		$args['date_created'] = '>=' . $da;
	}
	foreach ( wc_get_orders( $args ) as $ordine ) {
		if ( nutrex_headless_is_order( $ordine ) ) {
			return false;
		}
	}
	return true;
}

function nutrex_headless_e_membri( $codice ) {
	return strtolower( (string) $codice ) === nutrex_headless_account_config()['coupon_membri'];
}

/** Il proprietario del bonus Nutrex (0 se non e' un bonus Nutrex). */
function nutrex_headless_proprietario_bonus( $coupon ) {
	if ( ! $coupon instanceof WC_Coupon ) {
		$coupon = new WC_Coupon( $coupon );
	}
	return $coupon->get_id() ? (int) $coupon->get_meta( 'nutrex_headless_bonus_utente' ) : 0;
}

function nutrex_headless_e_nostro_coupon( $coupon ) {
	$codice = $coupon instanceof WC_Coupon ? $coupon->get_code() : (string) $coupon;
	return nutrex_headless_e_membri( $codice ) || nutrex_headless_proprietario_bonus( $coupon ) > 0;
}

/** Un codice promozionale del sito ospite (il suo sconto membri o un suo bonus amico)? */
function nutrex_headless_e_coupon_ospite( $coupon ) {
	if ( ! $coupon instanceof WC_Coupon ) {
		$coupon = new WC_Coupon( $coupon );
	}
	if ( nutrex_headless_e_nostro_coupon( $coupon ) ) {
		return false;
	}
	return 'membri-tdt' === strtolower( $coupon->get_code() ) || ( $coupon->get_id() && (int) $coupon->get_meta( 'tdta_bonus_utente' ) > 0 );
}

// lo sconto del primo ordine: un codice virtuale, lo definisce il plugin
add_filter(
	'woocommerce_get_shop_coupon_data',
	function ( $dati, $codice ) {
		$cfg = nutrex_headless_account_config();
		if ( false !== $dati || ! nutrex_headless_e_membri( $codice ) ) {
			return $dati;
		}
		return array(
			'discount_type'        => 'percent',
			'amount'               => $cfg['sconto_membri'],
			'individual_use'       => false,
			'usage_limit'          => 0,
			'usage_limit_per_user' => 0,
			'free_shipping'        => false,
			'exclude_sale_items'   => false,
			'product_categories'   => nutrex_headless_category_ids(),
			'description'          => 'Sconto primo ordine Nutrex Lab',
		);
	},
	10,
	2
);

/** Un codice vero, monouso, solo sui prodotti Nutrex, legato a un account: il premio di chi ha invitato. */
function nutrex_headless_crea_bonus( $proprietario, $amico ) {
	$cfg      = nutrex_headless_account_config();
	$alfabeto = '23456789abcdefghjkmnpqrstuvwxyz';
	do {
		$codice = 'nutrex-bonus-';
		for ( $i = 0; $i < 8; $i++ ) {
			$codice .= $alfabeto[ random_int( 0, strlen( $alfabeto ) - 1 ) ];
		}
	} while ( wc_get_coupon_id_by_code( $codice ) );
	$chi   = get_userdata( $proprietario );
	$nuovo = get_userdata( $amico );
	$c     = new WC_Coupon();
	$c->set_code( $codice );
	$c->set_discount_type( 'percent' );
	$c->set_amount( $cfg['bonus_amico'] );
	$c->set_individual_use( false );
	$c->set_usage_limit( 1 );
	$c->set_usage_limit_per_user( 1 );
	$c->set_product_categories( nutrex_headless_category_ids() );
	$c->set_description(
		'Nutrex Lab, invita un amico: bonus di ' . ( $chi ? $chi->display_name . ' (' . $chi->user_email . ')' : '#' . $proprietario )
		. ' per ' . ( $nuovo ? $nuovo->display_name : '#' . $amico ) . ', alla registrazione'
	);
	$c->update_meta_data( 'nutrex_headless_bonus_utente', (int) $proprietario );
	$c->update_meta_data( 'nutrex_headless_bonus_amico', (int) $amico );
	return $c->save();
}

/** I bonus Nutrex di un account: tutti, quelli ancora da usare, quanti usati. */
function nutrex_headless_bonus( $user_id ) {
	$r   = array( 'tutti' => 0, 'liberi' => array(), 'usati' => 0 );
	$ids = get_posts(
		array(
			'post_type'   => 'shop_coupon',
			'post_status' => 'publish',
			'numberposts' => -1,
			'fields'      => 'ids',
			'meta_key'    => 'nutrex_headless_bonus_utente', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			'meta_value'  => (int) $user_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'orderby'     => 'ID',
			'order'       => 'ASC',
		)
	);
	foreach ( $ids as $id ) {
		$c = new WC_Coupon( $id );
		$r['tutti']++;
		if ( $c->get_usage_count() < max( 1, (int) $c->get_usage_limit() ) ) {
			$r['liberi'][] = $c;
		} else {
			$r['usati']++;
		}
	}
	return $r;
}

/*
 * Chi puo' usare cosa: lo sconto del primo ordine solo con l'accesso, una volta e su un carrello Nutrex;
 * il bonus solo il suo proprietario, uno per ordine, su un carrello Nutrex. I codici del sito ospite
 * non valgono sui carrelli Nutrex (e i nostri non valgono sugli altri): niente doppi sconti.
 */
add_filter(
	'woocommerce_coupon_is_valid',
	function ( $valido, $coupon ) {
		if ( ! $valido || ! $coupon instanceof WC_Coupon || ! function_exists( 'WC' ) || ! WC()->cart ) {
			return $valido;
		}
		$nutrex = nutrex_headless_is_nutrex_cart();
		if ( nutrex_headless_e_coupon_ospite( $coupon ) ) {
			return $nutrex ? false : $valido;
		}
		if ( ! nutrex_headless_e_nostro_coupon( $coupon ) ) {
			return $valido;
		}
		if ( ! $nutrex ) {
			return false;
		}
		if ( nutrex_headless_e_membri( $coupon->get_code() ) ) {
			if ( ! is_user_logged_in() ) {
				throw new Exception( 'Lo sconto del primo ordine è riservato a chi ha un account Nutrex Lab: accedi o registrati.', 100 );
			}
			if ( ! nutrex_headless_primo_ordine_libero( get_current_user_id() ) ) {
				throw new Exception( 'Lo sconto per chi si registra vale sul primo ordine, e l&rsquo;hai già usato.', 100 );
			}
			return $valido;
		}
		$proprietario = nutrex_headless_proprietario_bonus( $coupon );
		if ( get_current_user_id() !== $proprietario ) {
			throw new Exception( 'Questo bonus appartiene a un altro account.', 100 );
		}
		foreach ( WC()->cart->get_applied_coupons() as $altro ) {
			if ( strtolower( $altro ) !== strtolower( $coupon->get_code() ) && nutrex_headless_proprietario_bonus( $altro ) ) {
				throw new Exception( 'Puoi usare un solo bonus amico per ordine: gli altri restano per i prossimi.', 100 );
			}
		}
		return $valido;
	},
	5,
	2
);

/** Applica un codice senza avvisi, solo se e' valido. */
function nutrex_headless_applica_zitto( $codice ) {
	$cart = WC()->cart;
	if ( $cart->has_discount( $codice ) ) {
		return true;
	}
	try {
		$esito = ( new WC_Discounts( $cart ) )->is_coupon_valid( new WC_Coupon( $codice ) );
	} catch ( Exception $e ) {
		return false;
	}
	if ( is_wp_error( $esito ) || ! $esito ) {
		return false;
	}
	return (bool) $cart->apply_coupon( $codice );
}

// i vantaggi entrano da soli nel carrello Nutrex di chi ha fatto l'accesso
function nutrex_headless_applica_vantaggi() {
	static $in_corso = false;
	if ( $in_corso || ( is_admin() && ! wp_doing_ajax() ) || ! is_user_logged_in() ) {
		return;
	}
	if ( ! function_exists( 'WC' ) || ! WC()->cart || WC()->cart->is_empty() || ! nutrex_headless_is_nutrex_cart() ) {
		return;
	}
	$in_corso = true;
	$cfg      = nutrex_headless_account_config();
	if ( nutrex_headless_primo_ordine_libero( get_current_user_id() ) ) {
		nutrex_headless_applica_zitto( $cfg['coupon_membri'] );
	} elseif ( WC()->cart->has_discount( $cfg['coupon_membri'] ) ) {
		WC()->cart->remove_coupon( $cfg['coupon_membri'] );
	}
	// i codici del sito ospite entrati da soli: via in silenzio
	foreach ( WC()->cart->get_applied_coupons() as $applicato ) {
		if ( nutrex_headless_e_coupon_ospite( $applicato ) ) {
			WC()->cart->remove_coupon( $applicato );
		}
	}
	$gia = false;
	foreach ( WC()->cart->get_applied_coupons() as $applicato ) {
		if ( nutrex_headless_proprietario_bonus( $applicato ) ) {
			$gia = true;
			break;
		}
	}
	if ( ! $gia ) {
		foreach ( nutrex_headless_bonus( get_current_user_id() )['liberi'] as $c ) {
			if ( nutrex_headless_applica_zitto( $c->get_code() ) ) {
				break;
			}
		}
	}
	$in_corso = false;
}
add_action( 'woocommerce_cart_loaded_from_session', 'nutrex_headless_applica_vantaggi', 30 );
add_action( 'woocommerce_add_to_cart', 'nutrex_headless_applica_vantaggi', 30 );

// niente "codice applicato" per i nostri: entrano da soli
add_filter(
	'woocommerce_coupon_message',
	function ( $messaggio, $codice_msg, $coupon = null ) {
		return $coupon instanceof WC_Coupon && nutrex_headless_e_nostro_coupon( $coupon ) ? '' : $messaggio;
	},
	10,
	3
);

// come si leggono al pagamento e negli ordini
add_filter(
	'woocommerce_cart_totals_coupon_label',
	function ( $etichetta, $coupon ) {
		if ( ! $coupon instanceof WC_Coupon ) {
			return $etichetta;
		}
		if ( nutrex_headless_e_membri( $coupon->get_code() ) ) {
			return 'Sconto primo ordine &minus;' . nutrex_headless_pct( $coupon->get_amount() ) . '%';
		}
		if ( nutrex_headless_proprietario_bonus( $coupon ) ) {
			return 'Bonus amico &minus;' . nutrex_headless_pct( $coupon->get_amount() ) . '%';
		}
		return $etichetta;
	},
	10,
	2
);

// e senza "[Rimuovi]": rientrerebbero comunque
add_filter(
	'woocommerce_cart_totals_coupon_html',
	function ( $html, $coupon, $importo_html = '' ) {
		return $coupon instanceof WC_Coupon && nutrex_headless_e_nostro_coupon( $coupon ) && '' !== $importo_html ? $importo_html : $html;
	},
	10,
	3
);

// ---------------------------------------------------------------------------- l'area: dashboard, voci, ordini

// dopo la pulizia della cornice (checkout-look.php): la dashboard e' la nostra, il resto dell'area e' di WooCommerce
add_action(
	'nutrex_headless_after_clean',
	function () {
		if ( ! nutrex_headless_on_account_page() ) {
			return;
		}
		remove_action( 'woocommerce_account_content', 'woocommerce_account_content' );
		if ( ! has_action( 'woocommerce_account_content', 'nutrex_headless_account_content' ) ) {
			add_action( 'woocommerce_account_content', 'nutrex_headless_account_content' );
		}
		remove_action( 'woocommerce_register_form', 'wc_registration_privacy_policy_text', 20 ); // la spunta privacy fa gia' il suo lavoro
	}
);

function nutrex_headless_account_content() {
	if ( '' === WC()->query->get_current_endpoint() ) {
		nutrex_headless_dashboard();
		return;
	}
	woocommerce_account_content();
}

function nutrex_headless_intestazione( $titolo, $sotto = '' ) {
	echo '<div class="nxa__head">'
		. '<h2 class="nxa__titolo">' . esc_html( $titolo ) . '</h2>'
		. ( $sotto ? '<p class="nxa__sotto">' . esc_html( $sotto ) . '</p>' : '' )
		. '</div>';
}

add_action(
	'woocommerce_before_customer_login_form',
	function () {
		if ( ! nutrex_headless_on_account_page() ) {
			return;
		}
		$cfg = nutrex_headless_account_config();
		nutrex_headless_intestazione(
			'Accedi o crea il tuo account',
			'Con un account hai il ' . nutrex_headless_pct( $cfg['sconto_membri'] ) . '% sul primo ordine e un link personale per invitare i tuoi amici: per ognuno che si registra, un bonus del ' . nutrex_headless_pct( $cfg['bonus_amico'] ) . '% per te.'
		);
	},
	5
);

foreach ( array( 'woocommerce_before_lost_password_form', 'woocommerce_before_lost_password_confirmation_message' ) as $nutrex_headless_hook ) {
	add_action(
		$nutrex_headless_hook,
		function () {
			if ( nutrex_headless_on_account_page() ) {
				nutrex_headless_intestazione( 'Password dimenticata?' );
			}
		},
		5
	);
}

add_action(
	'woocommerce_before_reset_password_form',
	function () {
		if ( nutrex_headless_on_account_page() ) {
			nutrex_headless_intestazione( 'Scegli una nuova password' );
		}
	},
	5
);

// prima della navigazione: il saluto nella dashboard, il titolo altrove
add_action(
	'woocommerce_account_navigation',
	function () {
		if ( ! nutrex_headless_on_account_page() ) {
			return;
		}
		$endpoint = WC()->query->get_current_endpoint();
		if ( '' === $endpoint ) {
			$utente = wp_get_current_user();
			$nome   = $utente->first_name ? $utente->first_name : $utente->display_name;
			nutrex_headless_intestazione( $nome ? 'Ciao, ' . $nome : 'Ciao!' );
			return;
		}
		$titolo = WC()->query->get_endpoint_title( $endpoint );
		nutrex_headless_intestazione( $titolo ? wp_strip_all_tags( $titolo ) : 'Il tuo account' );
	},
	5
);

add_filter(
	'woocommerce_account_menu_items',
	function ( $voci ) {
		if ( ! nutrex_headless_on_account_page() ) {
			return $voci;
		}
		if ( isset( $voci['dashboard'] ) ) {
			$voci['dashboard'] = 'Il tuo account';
		}
		unset( $voci['downloads'] );
		return $voci;
	},
	20
);

/** Gli ordini di un cliente: solo quelli Nutrex (o solo gli altri). */
function nutrex_headless_ordini_cliente( $user_id, $nutrex = true ) {
	$ids = array();
	foreach ( wc_get_orders( array( 'customer_id' => (int) $user_id, 'limit' => -1 ) ) as $ordine ) {
		if ( nutrex_headless_is_order( $ordine ) === $nutrex ) {
			$ids[] = $ordine->get_id();
		}
	}
	return $ids;
}

// l'elenco degli ordini: qui solo quelli Nutrex; nell'area clienti del sito ospite tutti gli altri
add_filter(
	'woocommerce_my_account_my_orders_query',
	function ( $args ) {
		if ( ! nutrex_headless_category_ids() || ! is_user_logged_in() ) {
			return $args;
		}
		if ( nutrex_headless_on_account_page() ) {
			$ids             = nutrex_headless_ordini_cliente( get_current_user_id(), true );
			$args['include'] = $ids ? $ids : array( 0 );
		} else {
			$ids = nutrex_headless_ordini_cliente( get_current_user_id(), false );
			$esclusi = array_diff( nutrex_headless_ordini_cliente( get_current_user_id(), true ), array() );
			if ( $esclusi ) {
				$args['exclude'] = array_merge( (array) ( $args['exclude'] ?? array() ), $esclusi );
			}
			unset( $ids );
		}
		return $args;
	},
	20
);

function nutrex_headless_amici( $user_id ) {
	$r   = array( 'registrati' => 0, 'validi' => 0 );
	$ids = get_users(
		array(
			'meta_key'    => 'nutrex_headless_invitato_da', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			'meta_value'  => (int) $user_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'fields'      => 'ID',
			'number'      => 1000,
			'count_total' => false,
		)
	);
	foreach ( $ids as $id ) {
		$stato = get_user_meta( $id, 'nutrex_headless_invito_stato', true );
		if ( 'non valido' === $stato ) {
			continue;
		}
		$r['registrati']++;
		if ( 'valido' === $stato ) {
			$r['validi']++;
		}
	}
	return $r;
}

function nutrex_headless_dashboard() {
	$uid    = get_current_user_id();
	$cfg    = nutrex_headless_account_config();
	$amici  = nutrex_headless_amici( $uid );
	$bonus  = nutrex_headless_bonus( $uid );
	$liberi = count( $bonus['liberi'] );
	$link   = nutrex_headless_link_invito( $uid );
	$codice = nutrex_headless_codice( $uid );
	$visite = max( (int) get_user_meta( $uid, 'nutrex_headless_visite', true ), $amici['registrati'] );
	$primo  = nutrex_headless_primo_ordine_libero( $uid );
	$totale = ( $primo ? $cfg['sconto_membri'] : 0 ) + ( $liberi ? $cfg['bonus_amico'] : 0 );
	$m      = nutrex_headless_pct( $cfg['sconto_membri'] );
	$b      = nutrex_headless_pct( $cfg['bonus_amico'] );
	$reg    = 1 === $amici['registrati'] ? '1 amico registrato' : $amici['registrati'] . ' amici registrati';

	echo '<div class="nxa-dash">';
	if ( (int) get_user_meta( $uid, 'nutrex_headless_benvenuto', true ) ) {
		delete_user_meta( $uid, 'nutrex_headless_benvenuto' );
		echo '<div class="nxa-benvenuto" role="status"><span class="nxa-benvenuto__segno" aria-hidden="true">&#10003;</span>'
			. '<div><strong>Benvenuto in Nutrex Lab.</strong><span>'
			. ( $primo ? 'Il tuo sconto del ' . esc_html( $m ) . '% sul primo ordine è attivo: si applica da solo al pagamento.' : 'Il tuo account è pronto.' )
			. '</span></div></div>';
	}

	if ( $liberi ) {
		$bonus_stato  = '<span class="nxa-stato is-on">Disponibile</span>';
		$bonus_nota   = $reg . ( $liberi > 1 ? ' · ' . $liberi . ' bonus, uno per ordine' : '' );
		$bonus_spento = '';
	} else {
		$bonus_stato  = '<span class="nxa-stato">Da sbloccare</span>';
		$bonus_nota   = $amici['registrati'] ? $reg : 'Invita un amico qui sotto';
		$bonus_spento = ' nxa-card--spento';
	}

	echo '<section class="nxa-vantaggi" aria-label="I tuoi vantaggi">';
	echo '<article class="nxa-card' . ( $primo ? '' : ' nxa-card--spento' ) . '">'
		. '<span class="nxa-card__label">Sconto primo ordine</span>'
		. '<strong class="nxa-card__num">&minus;' . esc_html( $m ) . '%</strong>'
		. '<span class="nxa-card__piede">' . ( $primo ? '<span class="nxa-stato is-on">Attivo</span>' : '<span class="nxa-stato">Usato</span>' ) . 'sul tuo primo ordine</span>'
		. '</article>';
	echo '<article class="nxa-card' . esc_attr( $bonus_spento ) . '">'
		. '<span class="nxa-card__label">Bonus amici</span>'
		. '<strong class="nxa-card__num">+' . esc_html( $b ) . '%</strong>'
		. '<span class="nxa-card__piede">' . $bonus_stato . esc_html( $bonus_nota ) . '</span>' // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		. '</article>';
	echo '<article class="nxa-card nxa-card--totale' . ( $totale ? '' : ' nxa-card--spento' ) . '">'
		. '<span class="nxa-card__label">I tuoi vantaggi</span>'
		. '<strong class="nxa-card__num">' . esc_html( nutrex_headless_pct( $totale ) ) . '%</strong>'
		. '<span class="nxa-card__piede">'
		. ( $totale ? '<span class="nxa-stato is-on">Disponibile</span>sul prossimo ordine' : '<span class="nxa-stato">Per ora nessuno</span>invita un amico: ' . esc_html( $b ) . '% per ognuno' )
		. '</span></article>';
	echo '</section>';

	if ( $link ) {
		$testo = 'Ti consiglio Nutrex Lab: registrati con il mio link, oppure con il mio codice ' . $codice . ', e avrai il ' . $m . '% di sconto sul primo ordine.';
		echo '<section class="nxa-invita" aria-labelledby="nxa-invita-t" data-nxa-messaggio="' . esc_attr( $testo ) . '">'
			. '<div class="nxa-invita__testo"><span class="nxa__occhiello">Invita un amico</span>'
			. '<h3 id="nxa-invita-t">Condividi il tuo link personale</h3>'
			. '<p>Per ogni amico che si registra con il tuo link ricevi subito un bonus del ' . esc_html( $b ) . '% da usare su un ordine. Il tuo amico, come tutti i nuovi iscritti, ha il ' . esc_html( $m ) . '% sul primo ordine.</p></div>'
			. '<div class="nxa-invita__azione">'
			. '<label class="nxa-link__label" for="nxa-link">Il tuo link personale</label>'
			. '<input class="nxa-link" id="nxa-link" type="text" readonly value="' . esc_attr( $link ) . '" data-nxa-link />'
			. '<div class="nxa-azioni">'
			. '<button type="button" class="nxa-btn nxa-btn--pieno" data-nxa-copia><span data-nxa-testo>Copia link</span></button>'
			. '<a class="nxa-btn" href="' . esc_url( 'https://wa.me/?text=' . rawurlencode( $testo . ' ' . $link ) ) . '" target="_blank" rel="noopener">WhatsApp</a>'
			. '<button type="button" class="nxa-btn" data-nxa-condividi><span data-nxa-testo>Condividi</span></button>'
			. '</div>'
			. '<p class="nxa-codice">Oppure dagli il tuo codice <button type="button" class="nxa-codice__b" data-nxa-copia-codice="' . esc_attr( $codice ) . '" title="Copia il codice"><span data-nxa-testo>' . esc_html( $codice ) . '</span></button></p>'
			. '</div></section>';
	}

	echo '<section class="nxa-risultati" aria-labelledby="nxa-risultati-t">'
		. '<span class="nxa__occhiello" id="nxa-risultati-t">I tuoi risultati</span><dl>'
		. '<div><dt>Amici invitati</dt><dd>' . esc_html( number_format_i18n( $visite ) ) . '</dd></div>'
		. '<div><dt>Registrazioni</dt><dd>' . esc_html( number_format_i18n( $amici['registrati'] ) ) . '</dd></div>'
		. '<div><dt>Bonus ottenuti</dt><dd>' . esc_html( nutrex_headless_pct( $bonus['tutti'] * $cfg['bonus_amico'] ) ) . '%</dd></div>'
		. '</dl></section>';
	echo '</div>';
}

// copia link e codice, condivisione (solo sulla dashboard Nutrex)
add_action(
	'wp_footer',
	function () {
		if ( ! nutrex_headless_on_account_page() || ! is_user_logged_in() ) {
			return;
		}
		?>
		<script id="nutrex-headless-account">
		(function () {
			var dash = document.querySelector('.nxa-dash'); if (!dash) return;
			var link = dash.querySelector('[data-nxa-link]');
			function detto(btn, testo) { var s = btn.querySelector('[data-nxa-testo]'); if (!s) return; var prima = s.textContent; s.textContent = testo; setTimeout(function () { s.textContent = prima; }, 1800); }
			function copia(testo, btn) { (navigator.clipboard ? navigator.clipboard.writeText(testo) : Promise.reject()).then(function () { detto(btn, 'Copiato ✓'); }, function () { if (link) { link.focus(); link.select(); } detto(btn, 'Tieni premuto sul link'); }); }
			dash.addEventListener('click', function (e) {
				var b = e.target.closest('[data-nxa-copia]'); if (b && link) return copia(link.value, b);
				var c = e.target.closest('[data-nxa-copia-codice]'); if (c) return copia(c.getAttribute('data-nxa-copia-codice'), c);
				var s = e.target.closest('[data-nxa-condividi]');
				if (s) { var sez = s.closest('[data-nxa-messaggio]'); var testo = sez ? sez.getAttribute('data-nxa-messaggio') : ''; if (navigator.share) navigator.share({ title: 'Nutrex Lab', text: testo, url: link ? link.value : location.href }).catch(function () {}); else if (link) copia(link.value, s); }
			});
		})();
		</script>
		<?php
	},
	50
);

// ---------------------------------------------------------------------------- promemoria al pagamento

/** Chi non ha fatto l'accesso: il vantaggio dell'account, con ritorno al pagamento ('' se non serve). */
function nutrex_headless_promemoria_html() {
	if ( is_user_logged_in() || ! nutrex_headless_on_checkout_page() || ! nutrex_headless_account_page_id() || ! is_checkout() || is_order_received_page() || is_checkout_pay_page() ) {
		return '';
	}
	$p = nutrex_headless_pct( nutrex_headless_account_config()['sconto_membri'] );
	return '<aside class="nxa-promemoria" aria-label="Sconto per chi si registra">'
		. '<strong class="nxa-promemoria__num">&minus;' . esc_html( $p ) . '%</strong>'
		. '<div class="nxa-promemoria__testo"><span class="nxa-promemoria__label">Con un account Nutrex Lab</span>'
		. '<p class="nxa-promemoria__titolo">Registrati e risparmi un ulteriore ' . esc_html( $p ) . '% sul primo ordine</p>'
		. '<p class="nxa-promemoria__sotto">Si aggiunge agli altri sconti, già su questo ordine.</p></div>'
		. '<div class="nxa-promemoria__azioni">'
		. '<a class="nxa-promemoria__btn" href="' . esc_url( nutrex_headless_account_url( array( 'torna' => 'pagamento', 'vista' => 'registrati' ) ) ) . '">Crea il tuo account</a>'
		. '<span class="nxa-promemoria__accedi">Hai già un account? <a href="' . esc_url( nutrex_headless_account_url( array( 'torna' => 'pagamento' ) ) ) . '">Accedi</a></span>'
		. '</div></aside>';
}

// checkout classico: sopra al modulo
add_action(
	'woocommerce_before_checkout_form',
	function () {
		echo nutrex_headless_promemoria_html(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	},
	5
);

// checkout a blocchi: sopra al blocco
add_filter(
	'render_block_woocommerce/checkout',
	function ( $html ) {
		return nutrex_headless_promemoria_html() . $html;
	}
);

// da telefono la registrazione va per prima quando si arriva per registrarsi o da un invito
add_filter(
	'body_class',
	function ( $classi ) {
		if ( nutrex_headless_on_account_page() && ! is_user_logged_in() ) {
			$registrati = isset( $_GET['vista'] ) && 'registrati' === $_GET['vista']; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $registrati || nutrex_headless_codice_invito_corrente() ) {
				$classi[] = 'nxa-prima-registrazione';
			}
		}
		return $classi;
	},
	20
);

// ---------------------------------------------------------------------------- in bacheca: WooCommerce > Nutrex Lab: inviti

add_action(
	'admin_menu',
	function () {
		add_submenu_page( 'woocommerce', 'Nutrex Lab: inviti', 'Nutrex Lab: inviti', 'manage_woocommerce', 'nutrex-headless-inviti', 'nutrex_headless_pagina_inviti' );
	},
	60
);

function nutrex_headless_pagina_inviti() {
	$cfg    = nutrex_headless_account_config();
	$utenti = get_users(
		array(
			'meta_key'    => 'nutrex_headless_codice', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			'number'      => 500,
			'orderby'     => 'registered',
			'order'       => 'DESC',
			'count_total' => false,
		)
	);
	echo '<div class="wrap"><h1>Nutrex Lab: inviti e bonus</h1>'
		. '<p>Chi si registra dall\'area clienti di nutrexlab.it ha il ' . esc_html( nutrex_headless_pct( $cfg['sconto_membri'] ) ) . '% sul primo ordine Nutrex e un codice personale: per ogni amico che si registra riceve un bonus del ' . esc_html( nutrex_headless_pct( $cfg['bonus_amico'] ) ) . '% (codice monouso sui prodotti Nutrex, uno per ordine). I codici sono in Marketing &rsaquo; Codici promozionali, con "nutrex-bonus-" davanti.</p>';
	echo '<table class="widefat striped"><thead><tr><th>Cliente</th><th>Registrato</th><th>Codice</th><th>Invitato da</th><th>Amici registrati</th><th>Bonus (liberi / usati)</th><th>Primo ordine</th></tr></thead><tbody>';
	if ( ! $utenti ) {
		echo '<tr><td colspan="7">Ancora nessun cliente registrato da Nutrex Lab.</td></tr>';
	}
	foreach ( $utenti as $u ) {
		$amici = nutrex_headless_amici( $u->ID );
		$bonus = nutrex_headless_bonus( $u->ID );
		$da    = (int) get_user_meta( $u->ID, 'nutrex_headless_invitato_da', true );
		$da_u  = $da ? get_userdata( $da ) : false;
		$stato = (string) get_user_meta( $u->ID, 'nutrex_headless_invito_stato', true );
		echo '<tr>'
			. '<td><a href="' . esc_url( get_edit_user_link( $u->ID ) ) . '">' . esc_html( $u->display_name ) . '</a><br><small>' . esc_html( $u->user_email ) . '</small></td>'
			. '<td>' . esc_html( wp_date( 'j M Y', strtotime( $u->user_registered . ' UTC' ) ) ) . ( get_user_meta( $u->ID, 'nutrex_headless_customer', true ) ? '' : '<br><small>(dal sito ospite)</small>' ) . '</td>'
			. '<td><code>' . esc_html( nutrex_headless_codice( $u->ID, false ) ) . '</code></td>'
			. '<td>' . ( $da_u ? esc_html( $da_u->display_name ) . ( 'valido' === $stato ? '' : '<br><small>' . esc_html( $stato . ( get_user_meta( $u->ID, 'nutrex_headless_invito_motivo', true ) ? ': ' . get_user_meta( $u->ID, 'nutrex_headless_invito_motivo', true ) : '' ) ) . '</small>' ) : '&ndash;' ) . '</td>'
			. '<td>' . (int) $amici['registrati'] . '</td>'
			. '<td>' . count( $bonus['liberi'] ) . ' / ' . (int) $bonus['usati'] . '</td>'
			. '<td>' . ( nutrex_headless_primo_ordine_libero( $u->ID ) ? 'sconto ancora disponibile' : 'fatto' ) . '</td>'
			. '</tr>';
	}
	echo '</tbody></table></div>';
}
