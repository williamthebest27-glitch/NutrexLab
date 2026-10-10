<?php
/**
 * Lingue delle pagine Nutrex di questo WordPress (pagamento, "Ordine ricevuto", "Paga l'ordine" e area
 * clienti), le stesse del sito nutrexlab.it: italiano, inglese, francese, tedesco e spagnolo.
 *
 * - La lingua arriva dal sito: il passaggio al pagamento e il link /account portano ?nutrex_lang=de
 *   (api/checkout.js, api/account.js); da li' resta nel cookie nutrex_lang, anche per le richieste che
 *   la pagina fa dopo (Store API del checkout a blocchi, wc-ajax del checkout classico e dei metodi di
 *   pagamento). In alto nella pagina c'e' la scelta della lingua (bandiera e tendina, come sul sito).
 * - Su quelle pagine WordPress usa la lingua scelta: i testi di WooCommerce, dei metodi di pagamento e di
 *   WordPress arrivano dai loro pacchetti di lingua (Bacheca > Aggiornamenti > Traduzioni; senza
 *   pacchetto si vedono in inglese). I testi scritti da questo plugin si traducono con lang/<lingua>.json:
 *   la chiave e' il testo italiano, come sul sito ({x} = segnaposto).
 * - Il resto del sito ospite e la bacheca restano nella lingua del sito. Le email partono sempre nella
 *   lingua del sito (i testi delle email Nutrex sono in italiano): mai un'email in due lingue.
 */

defined( 'ABSPATH' ) || exit;

define(
	'NUTREX_HEADLESS_LANGS',
	array(
		// locale: i pacchetti di WordPress da usare, il primo installato (in tedesco "du", come sul sito)
		'it' => array( 'name' => 'Italiano', 'short' => 'IT', 'locales' => array( 'it_IT' ) ),
		'en' => array( 'name' => 'English', 'short' => 'EN', 'locales' => array( 'en_GB', 'en_US' ) ),
		'fr' => array( 'name' => 'Français', 'short' => 'FR', 'locales' => array( 'fr_FR' ) ),
		'de' => array( 'name' => 'Deutsch', 'short' => 'DE', 'locales' => array( 'de_DE', 'de_DE_formal', 'de_AT', 'de_CH' ) ),
		'es' => array( 'name' => 'Español', 'short' => 'ES', 'locales' => array( 'es_ES' ) ),
	)
);

/** La lingua scelta dal cliente: ?nutrex_lang= nell'indirizzo, poi il cookie, poi l'italiano. */
function nutrex_headless_lang_choice() {
	static $lang = null;
	if ( null !== $lang ) {
		return $lang;
	}
	foreach ( array( $_GET, $_COOKIE ) as $source ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$value = isset( $source['nutrex_lang'] ) && is_string( $source['nutrex_lang'] ) ? sanitize_key( wp_unslash( $source['nutrex_lang'] ) ) : '';
		if ( array_key_exists( $value, NUTREX_HEADLESS_LANGS ) ) {
			$lang = $value;
			return $lang;
		}
	}
	$lang = 'it';
	return $lang;
}

/** Percorsi delle pagine Nutrex (pagamento e area clienti), per riconoscerle prima che WordPress le carichi. */
function nutrex_headless_lang_pages() {
	static $pages = null;
	if ( null === $pages ) {
		$pages = array();
		foreach ( array( 'nutrex_headless_checkout_page', 'nutrex_headless_account_page' ) as $option ) {
			$id  = absint( get_option( $option, 0 ) );
			$uri = $id ? get_page_uri( $id ) : '';
			if ( $uri ) {
				$pages[ $id ] = $uri;
			}
		}
	}
	return $pages;
}

/** L'indirizzo e' di una pagina Nutrex (anche i suoi endpoint: order-received, orders...)? */
function nutrex_headless_lang_is_page_url( $url ) {
	$url = (string) $url;
	if ( '' === $url ) {
		return false;
	}
	$path  = (string) wp_parse_url( $url, PHP_URL_PATH );
	$query = array();
	wp_parse_str( (string) wp_parse_url( $url, PHP_URL_QUERY ), $query );
	foreach ( nutrex_headless_lang_pages() as $id => $uri ) {
		if ( preg_match( '#/' . preg_quote( $uri, '#' ) . '(/|$)#', $path ) || ( isset( $query['page_id'] ) && (int) $query['page_id'] === $id ) ) {
			return true;
		}
	}
	return false;
}

/**
 * La richiesta riguarda le pagine Nutrex: la pagina stessa, il passaggio dal carrello di nutrexlab.it, un
 * modulo dell'area clienti, oppure una richiesta fatta da quelle pagine (Store API con l'intestazione
 * X-Nutrex-Checkout, wc-ajax e admin-ajax del checkout classico e dei metodi di pagamento). Si decide
 * dall'indirizzo, prima che WordPress carichi le traduzioni. Mai in bacheca, nel cron o da WP-CLI.
 */
function nutrex_headless_lang_request() {
	static $on = null;
	if ( null !== $on ) {
		return $on;
	}
	$on = false;
	if ( ( is_admin() && ! wp_doing_ajax() ) || wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
		return $on;
	}
	// phpcs:disable WordPress.Security.NonceVerification, WordPress.Security.ValidatedSanitizedInput
	if ( ! empty( $_GET['nutrex-checkout'] ) || ! empty( $_POST['nutrex_account'] ) || ! empty( $_SERVER['HTTP_X_NUTREX_CHECKOUT'] ) ) {
		$on = true;
		return $on;
	}
	$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	if ( nutrex_headless_lang_is_page_url( $uri ) ) {
		$on = true;
		return $on;
	}
	$ajax = wp_doing_ajax() || isset( $_GET['wc-ajax'] ) || isset( $_GET['rest_route'] ) || false !== strpos( $uri, '/' . trim( rest_get_url_prefix(), '/' ) . '/' );
	$from = isset( $_SERVER['HTTP_REFERER'] ) ? (string) wp_unslash( $_SERVER['HTTP_REFERER'] ) : '';
	// phpcs:enable
	if ( $ajax && $from && strtolower( (string) wp_parse_url( $from, PHP_URL_HOST ) ) === strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) ) {
		$on = nutrex_headless_lang_is_page_url( $from );
	}
	return $on;
}

/** La lingua dei testi in questo momento: quella scelta sulle pagine Nutrex, l'italiano altrove e nelle email. */
function nutrex_headless_lang() {
	if ( ! empty( $GLOBALS['nutrex_headless_lang_pause'] ) || ! nutrex_headless_lang_request() ) {
		return 'it';
	}
	return nutrex_headless_lang_choice();
}

/** Il pacchetto di WordPress per una lingua: il primo installato (senza pacchetti, il primo dell'elenco). */
function nutrex_headless_lang_locale( $lang ) {
	static $found = array();
	if ( ! isset( $found[ $lang ] ) ) {
		$locales        = array_key_exists( $lang, NUTREX_HEADLESS_LANGS ) ? NUTREX_HEADLESS_LANGS[ $lang ]['locales'] : array( 'it_IT' );
		$installed      = array_merge( array( 'en_US' ), get_available_languages() );
		$match          = array_values( array_intersect( $locales, $installed ) );
		$found[ $lang ] = $match ? $match[0] : $locales[0];
	}
	return $found[ $lang ];
}

/** La lingua del sito ospite (quella che WordPress userebbe senza questo plugin). */
function nutrex_headless_site_locale() {
	if ( ! empty( $GLOBALS['nutrex_headless_site_locale'] ) ) {
		return $GLOBALS['nutrex_headless_site_locale'];
	}
	$wplang = (string) get_option( 'WPLANG' );
	return '' !== $wplang ? $wplang : 'en_US';
}

/** Le pagine Nutrex sono in una lingua diversa da quella del sito? */
function nutrex_headless_lang_differs() {
	return nutrex_headless_lang_request() && nutrex_headless_lang_locale( nutrex_headless_lang_choice() ) !== nutrex_headless_site_locale();
}

/*
 * La lingua di WordPress sulle pagine Nutrex. Si fa da parte quando qualcuno cambia lingua per un
 * momento (switch_to_locale: le email, qui sotto), e torna dopo.
 */
function nutrex_headless_filter_locale( $locale ) {
	$switched = isset( $GLOBALS['wp_locale_switcher'] ) && is_locale_switched();
	if ( $switched || ! nutrex_headless_lang_request() ) {
		return $locale;
	}
	if ( 'locale' === current_filter() ) {
		$GLOBALS['nutrex_headless_site_locale'] = $locale;
	}
	return nutrex_headless_lang_locale( nutrex_headless_lang_choice() );
}
add_filter( 'locale', 'nutrex_headless_filter_locale', PHP_INT_MAX );
add_filter( 'determine_locale', 'nutrex_headless_filter_locale', PHP_INT_MAX );

// la lingua scelta resta per le pagine e le richieste dopo (un anno, solo su questo dominio)
add_action(
	'init',
	function () {
		$asked = isset( $_GET['nutrex_lang'] ) && is_string( $_GET['nutrex_lang'] ) ? sanitize_key( wp_unslash( $_GET['nutrex_lang'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! array_key_exists( $asked, NUTREX_HEADLESS_LANGS ) || ( $_COOKIE['nutrex_lang'] ?? '' ) === $asked || headers_sent() ) {
			return;
		}
		setcookie(
			'nutrex_lang',
			$asked,
			array(
				'expires'  => time() + YEAR_IN_SECONDS,
				'path'     => COOKIEPATH ? COOKIEPATH : '/',
				'domain'   => COOKIE_DOMAIN,
				'secure'   => is_ssl(),
				'httponly' => true,
				'samesite' => 'Lax',
			)
		);
		$_COOKIE['nutrex_lang'] = $asked;
	},
	0
);

// ---------------------------------------------------------------------------- email: nella lingua del sito

/*
 * Le email partono durante le richieste delle pagine Nutrex (ordine pagato, nuovo account, nuova
 * password): per ognuna WordPress torna alla lingua del sito finche' l'email non e' pronta, sia per i
 * clienti sia per le notifiche a Nutrex Lab. Intanto WooCommerce non cambia lingua da solo (lo farebbe
 * con la lingua della pagina).
 */
function nutrex_headless_lang_pause() {
	if ( ! empty( $GLOBALS['nutrex_headless_lang_pause'] ) ) {
		$GLOBALS['nutrex_headless_lang_pause']++;
		return;
	}
	if ( ! nutrex_headless_lang_differs() || ! function_exists( 'switch_to_locale' ) || ! switch_to_locale( nutrex_headless_site_locale() ) ) {
		return;
	}
	$GLOBALS['nutrex_headless_lang_pause'] = 1;
}

function nutrex_headless_lang_resume() {
	if ( empty( $GLOBALS['nutrex_headless_lang_pause'] ) ) {
		return;
	}
	$GLOBALS['nutrex_headless_lang_pause']--;
	if ( ! $GLOBALS['nutrex_headless_lang_pause'] ) {
		restore_previous_locale();
	}
}

add_filter(
	'woocommerce_email_actions',
	function ( $actions ) {
		// (la nuova password dall'area clienti non passa dall'elenco: WooCommerce la aggancia da se')
		foreach ( array_merge( (array) $actions, array( 'woocommerce_reset_password_notification' ) ) as $action ) {
			add_action( $action, 'nutrex_headless_lang_pause', 9 );
			add_action( $action, 'nutrex_headless_lang_resume', 11 );
		}
		return $actions;
	},
	PHP_INT_MAX
);

foreach ( array( 'woocommerce_email_setup_locale', 'woocommerce_email_restore_locale' ) as $nutrex_headless_hook ) {
	add_filter(
		$nutrex_headless_hook,
		function ( $on ) {
			return empty( $GLOBALS['nutrex_headless_lang_pause'] ) ? $on : false;
		},
		PHP_INT_MAX
	);
}

// ---------------------------------------------------------------------------- testi del plugin

/** Le traduzioni di una lingua (lang/<lingua>.json: testo italiano -> traduzione). */
function nutrex_headless_lang_dict( $lang ) {
	static $dicts = array();
	if ( ! isset( $dicts[ $lang ] ) ) {
		$file           = dirname( __DIR__ ) . '/lang/' . $lang . '.json';
		$data           = is_readable( $file ) ? json_decode( (string) file_get_contents( $file ), true ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$dicts[ $lang ] = is_array( $data ) ? $data : array();
	}
	return $dicts[ $lang ];
}

/**
 * Un testo del plugin nella lingua della pagina (la chiave e' il testo italiano). vars: { n: 5 } per i
 * segnaposto {n}, inseriti come sono (chi chiama li ha gia' resi sicuri per l'HTML, se serve).
 */
function nutrex_headless_t( $it, $vars = array() ) {
	$lang = nutrex_headless_lang();
	$text = $it;
	if ( 'it' !== $lang ) {
		$dict = nutrex_headless_lang_dict( $lang );
		if ( isset( $dict[ $it ] ) && '' !== $dict[ $it ] ) {
			$text = $dict[ $it ];
		}
	}
	if ( $vars ) {
		$text = preg_replace_callback(
			'/\{(\w+)\}/',
			function ( $m ) use ( $vars ) {
				return array_key_exists( $m[1], $vars ) ? (string) $vars[ $m[1] ] : $m[0];
			},
			$text
		);
	}
	return $text;
}

/** Singolare o plurale (in francese anche lo 0 e' singolare), come tp() del sito. */
function nutrex_headless_tp( $n, $one, $other, $vars = array() ) {
	$single = 'fr' === nutrex_headless_lang() ? ( 0 === (int) $n || 1 === (int) $n ) : 1 === (int) $n;
	return nutrex_headless_t( $single ? $one : $other, array_merge( array( 'n' => $n ), $vars ) );
}

/** Un link verso nutrexlab.it dalle pagine Nutrex: porta la lingua, cosi' il sito resta nella stessa. */
function nutrex_headless_lang_url( $url ) {
	if ( ! nutrex_headless_lang_request() || ! empty( $GLOBALS['nutrex_headless_lang_pause'] ) ) {
		return $url;
	}
	return add_query_arg( 'lang', nutrex_headless_lang_choice(), $url );
}

// ---------------------------------------------------------------------------- scelta della lingua

/** Bandiera e sigla della lingua, con la tendina delle cinque lingue (in alto nelle pagine Nutrex). */
function nutrex_headless_lang_picker() {
	$current = nutrex_headless_lang_choice();
	$info    = NUTREX_HEADLESS_LANGS[ $current ];
	$label   = nutrex_headless_t( 'Lingua del sito: {lingua}. Cambia lingua', array( 'lingua' => $info['name'] ) );
	$flag    = function ( $lang ) {
		return '<svg class="nx-lang__flag" viewBox="0 0 30 20" aria-hidden="true"><use href="#nx-flag-' . esc_attr( $lang ) . '" /></svg>';
	};
	$html  = '<div class="nx-lang" data-nx-lang>';
	$html .= '<button class="nx-lang__btn" type="button" aria-expanded="false" aria-controls="nx-lang-menu" aria-haspopup="true" aria-label="' . esc_attr( $label ) . '">'
		. $flag( $current )
		. '<span class="nx-lang__code">' . esc_html( $info['short'] ) . '</span>'
		. '<svg class="nx-lang__chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1.5 1.75 6 6.25l4.5-4.5" /></svg>'
		. '</button>';
	$html .= '<div class="nx-lang__menu" id="nx-lang-menu"><ul class="nx-lang__card" role="list">';
	foreach ( NUTREX_HEADLESS_LANGS as $lang => $data ) {
		$on    = $lang === $current;
		$html .= '<li><a class="nx-lang__opt' . ( $on ? ' is-on' : '' ) . '" href="' . esc_url( add_query_arg( 'nutrex_lang', $lang ) ) . '" hreflang="' . esc_attr( $lang ) . '" lang="' . esc_attr( $lang ) . '"' . ( $on ? ' aria-current="true"' : '' ) . '>'
			. $flag( $lang ) . '<span>' . esc_html( $data['name'] ) . '</span></a></li>';
	}
	$html .= '</ul></div>';
	// bandiere (le stesse del sito, src/partials/nav.html)
	$html .= '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">'
		. '<symbol id="nx-flag-it" viewBox="0 0 30 20"><rect width="10" height="20" fill="#009246" /><rect x="10" width="10" height="20" fill="#f4f5f0" /><rect x="20" width="10" height="20" fill="#ce2b37" /></symbol>'
		. '<symbol id="nx-flag-fr" viewBox="0 0 30 20"><rect width="10" height="20" fill="#002654" /><rect x="10" width="10" height="20" fill="#f4f5f0" /><rect x="20" width="10" height="20" fill="#ce1126" /></symbol>'
		. '<symbol id="nx-flag-de" viewBox="0 0 30 20"><rect width="30" height="6.67" fill="#111" /><rect y="6.67" width="30" height="6.67" fill="#dd0000" /><rect y="13.33" width="30" height="6.67" fill="#ffce00" /></symbol>'
		. '<symbol id="nx-flag-es" viewBox="0 0 30 20"><rect width="30" height="20" fill="#aa151b" /><rect y="5" width="30" height="10" fill="#f1bf00" /></symbol>'
		. '<defs><clipPath id="nx-flag-en-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath></defs>'
		. '<symbol id="nx-flag-en" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><path d="M0 0v30h60V0z" fill="#012169" /><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6" /><path d="M0 0l60 30m0-30L0 30" clip-path="url(#nx-flag-en-t)" stroke="#c8102e" stroke-width="4" /><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10" /><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6" /></symbol>'
		. '</svg>';
	$html .= '</div>';
	return $html;
}

/*
 * La tendina: si apre e si chiude toccando la bandiera, si chiude toccando fuori o con Esc; da tastiera
 * frecce su/giu' tra le lingue. Scegliendo una lingua la pagina si ricarica in quella lingua (i dati gia'
 * scritti nel checkout restano: WooCommerce li salva mentre si scrive).
 */
function nutrex_headless_lang_picker_script() {
	?>
	<script id="nutrex-headless-lang">
	(function () {
		var root = document.querySelector('[data-nx-lang]'); if (!root) return;
		var btn = root.querySelector('.nx-lang__btn');
		var opts = [].slice.call(root.querySelectorAll('.nx-lang__opt'));
		var open = false;
		function set(v) { open = v; root.classList.toggle('is-open', v); btn.setAttribute('aria-expanded', v ? 'true' : 'false'); }
		btn.addEventListener('click', function () {
			set(!open);
			if (open) { var on = root.querySelector('.nx-lang__opt.is-on') || opts[0]; if (on) on.focus({ preventScroll: true }); }
		});
		opts.forEach(function (o) { o.addEventListener('click', function () { root.classList.add('is-busy'); set(false); }); });
		root.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && open) { set(false); btn.focus(); return; }
			if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
			e.preventDefault();
			var i = opts.indexOf(document.activeElement);
			var next = opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length];
			if (next) next.focus();
		});
		document.addEventListener('pointerdown', function (e) { if (open && !root.contains(e.target)) set(false); });
		root.addEventListener('focusout', function (e) { if (open && e.relatedTarget && !root.contains(e.relatedTarget)) set(false); });
		// tornando indietro alla pagina (cache del browser) la bandiera non resta "in attesa"
		window.addEventListener('pageshow', function () { root.classList.remove('is-busy'); });
	})();
	</script>
	<?php
}
