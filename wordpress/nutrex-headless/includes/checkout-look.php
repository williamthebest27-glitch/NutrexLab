<?php
/**
 * La cornice di Nutrex Lab sulla sua pagina di pagamento (checkout-page.php): logo, colori e caratteri
 * di Nutrex, senza intestazione, menu e pie' di pagina del tema di questo sito. Il contenuto resta quello
 * di WooCommerce (dati, spedizione, metodi di pagamento, riepilogo). Vale solo su quella pagina:
 * checkout, "Ordine ricevuto" e "Paga l'ordine" degli ordini Nutrex. Le pagine di questo sito (anche il
 * suo checkout e il suo carrello) non cambiano mai.
 */

defined( 'ABSPATH' ) || exit;

/** Quale pagina Nutrex si sta aprendo: 'checkout', 'received', 'pay' o '' (non e' la pagina Nutrex). */
function nutrex_headless_look() {
	static $look = null;
	if ( null !== $look ) {
		return $look;
	}
	if ( ! did_action( 'wp' ) ) {
		return ''; // pagina non ancora nota: si decide dopo
	}
	$look = '';
	if ( ! nutrex_headless_on_checkout_page() ) {
		return $look;
	}
	if ( is_order_received_page() ) {
		$look = 'received';
	} elseif ( is_checkout_pay_page() ) {
		$look = 'pay';
	} else {
		$look = 'checkout';
	}
	return $look;
}

add_action(
	'template_redirect',
	function () {
		if ( ! nutrex_headless_look() ) {
			return;
		}
		// niente CSS aggiuntivo del tema (Personalizza), avviso del negozio o feed di questo sito
		remove_action( 'wp_head', 'wp_custom_css_cb', 101 );
		remove_action( 'wp_footer', 'woocommerce_demo_store' );
		remove_action( 'wp_head', 'feed_links', 2 );
		remove_action( 'wp_head', 'feed_links_extra', 3 );
		remove_action( 'wp_head', 'rsd_link' );
		remove_action( 'wp_head', 'wlwmanifest_link' );
		nutrex_headless_remove_title_tags();
		nutrex_headless_clean_frame();
	},
	PHP_INT_MAX
);

/**
 * Il <title> lo stampa il modello (templates/checkout.php): via quelli di WordPress (tema classico e a
 * blocchi; quest'ultimo lo aggancia mentre sceglie il modello, dopo template_redirect). I plugin SEO del
 * sito, che di solito lo stampano loro, qui sono esclusi (nutrex_headless_clean_frame).
 */
function nutrex_headless_remove_title_tags() {
	global $wp_filter;
	if ( empty( $wp_filter['wp_head'] ) ) {
		return;
	}
	foreach ( $wp_filter['wp_head']->callbacks as $priority => $callbacks ) {
		foreach ( $callbacks as $callback ) {
			if ( is_string( $callback['function'] ) && preg_match( '/render_title_tag$/', $callback['function'] ) ) {
				remove_action( 'wp_head', $callback['function'], $priority );
			}
		}
	}
}

/*
 * Cornice pulita: sulla pagina Nutrex niente di cio' che il tema e le personalizzazioni di questo sito
 * aggiungono a tutte le pagine o al checkout (menu, pie' di pagina, intestazione e passaggi del
 * checkout, avvisi, stili e script). Restano WordPress, WooCommerce, i metodi di pagamento, la cache del
 * sito e questo plugin. Solo sulla pagina Nutrex: le pagine di questo sito non cambiano.
 */

/** File in cui e' scritta una funzione agganciata (vuoto se non si sa). */
function nutrex_headless_callback_file( $callback ) {
	try {
		if ( is_string( $callback ) && false !== strpos( $callback, '::' ) ) {
			$callback = explode( '::', $callback, 2 );
		}
		if ( is_array( $callback ) && 2 === count( $callback ) ) {
			$reflection = new ReflectionMethod( $callback[0], $callback[1] );
		} elseif ( $callback instanceof Closure || is_string( $callback ) ) {
			$reflection = new ReflectionFunction( $callback );
		} elseif ( is_object( $callback ) && method_exists( $callback, '__invoke' ) ) {
			$reflection = new ReflectionMethod( $callback, '__invoke' );
		} else {
			return '';
		}
		return wp_normalize_path( (string) $reflection->getFileName() );
	} catch ( ReflectionException $e ) {
		return '';
	}
}

/**
 * La funzione (o il file) viene da WordPress, WooCommerce, un metodo di pagamento, la cache del sito o da
 * questo plugin? Si guardano le cartelle nel percorso, non il percorso intero: sugli hosting con link
 * simbolici (SiteGround) ABSPATH e i percorsi dei file hanno prefissi diversi.
 */
function nutrex_headless_is_essential( $file ) {
	$file = wp_normalize_path( (string) $file );
	if ( '' === $file ) {
		return true; // provenienza sconosciuta: si lascia
	}
	if ( false !== strpos( $file, '/siteground-optimizer-assets/' ) ) {
		return true; // copie ottimizzate dalla cache del sito (anche di WooCommerce)
	}
	if ( 0 === strpos( $file, wp_normalize_path( dirname( NUTREX_HEADLESS_FILE ) ) . '/' ) || false !== strpos( $file, '/plugins/nutrex-headless/' ) ) {
		return true; // questo plugin
	}
	if ( preg_match( '#/(wp-includes|wp-admin)/#', $file ) ) {
		return true; // WordPress
	}
	if ( preg_match( '#/(themes|mu-plugins)/#', $file ) ) {
		return false; // tema e codice aggiunto al sito
	}
	if ( preg_match( '#/plugins/([^/]+)/#', $file, $m ) ) {
		$folder = $m[1];
		return 'woocommerce' === $folder || 'sg-cachepress' === $folder || (bool) preg_match( '/pay|stripe|klarna|gateway|satispay|scalapay|nexi|mollie|braintree|square|amazon/i', $folder );
	}
	return true; // WordPress stesso o file di cui non si sa: si lascia
}

/** Toglie dalle azioni e dai filtri della cornice cio' che non e' essenziale. */
function nutrex_headless_clean_frame() {
	global $wp_filter;
	$hooks = array(
		'wp_head',
		'wp_body_open',
		'wp_footer',
		'body_class',
		'the_content',
		'woocommerce_before_checkout_form',
		'woocommerce_after_checkout_form',
		'woocommerce_checkout_before_customer_details',
		'woocommerce_checkout_after_customer_details',
		'woocommerce_before_checkout_billing_form',
		'woocommerce_after_checkout_billing_form',
		'woocommerce_before_checkout_shipping_form',
		'woocommerce_after_checkout_shipping_form',
		'woocommerce_before_order_notes',
		'woocommerce_after_order_notes',
		'woocommerce_checkout_before_order_review_heading',
		'woocommerce_checkout_before_order_review',
		'woocommerce_checkout_order_review',
		'woocommerce_checkout_after_order_review',
		'woocommerce_review_order_before_cart_contents',
		'woocommerce_review_order_after_cart_contents',
		'woocommerce_review_order_before_order_total',
		'woocommerce_review_order_after_order_total',
		'woocommerce_review_order_before_payment',
		'woocommerce_review_order_after_payment',
		'woocommerce_review_order_before_submit',
		'woocommerce_review_order_after_submit',
		'woocommerce_checkout_before_terms_and_conditions',
		'woocommerce_checkout_after_terms_and_conditions',
		'woocommerce_before_thankyou',
		'woocommerce_thankyou',
		'woocommerce_pay_order_before_submit',
		'woocommerce_pay_order_after_submit',
	);
	foreach ( $hooks as $hook ) {
		if ( empty( $wp_filter[ $hook ] ) ) {
			continue;
		}
		foreach ( $wp_filter[ $hook ]->callbacks as $priority => $callbacks ) {
			foreach ( $callbacks as $callback ) {
				if ( ! nutrex_headless_is_essential( nutrex_headless_callback_file( $callback['function'] ) ) ) {
					remove_filter( $hook, $callback['function'], $priority );
				}
			}
		}
	}
}

// anche cio' che si aggancia mentre la pagina si scrive (prima del corpo e prima del pie' di pagina)
foreach ( array( 'wp_body_open', 'wp_footer' ) as $nutrex_headless_hook ) {
	add_action(
		$nutrex_headless_hook,
		function () {
			if ( nutrex_headless_look() ) {
				nutrex_headless_clean_frame();
			}
		},
		-1000
	);
}

// sulla pagina Nutrex il nome del sito e' Nutrex Lab (testi di WooCommerce e dei metodi di pagamento, meta)
add_filter(
	'option_blogname',
	function ( $name ) {
		return nutrex_headless_look() ? 'Nutrex Lab' : $name;
	}
);

// la cache del sito (SG Optimizer) toglie i <link> degli stili e mette il suo foglio unito dopo </title>:
// qui lo mette prima di </head>, cosi' c'e' sempre anche se un plugin cambia il titolo
add_filter(
	'sgo_css_combine_position',
	function ( $position ) {
		return nutrex_headless_look() ? 'head' : $position;
	}
);

// la pagina si apre con il modello del plugin (cornice Nutrex) al posto di quello del tema
add_filter(
	'template_include',
	function ( $template ) {
		if ( ! nutrex_headless_look() ) {
			return $template;
		}
		// (cio' che il tema ha agganciato scegliendo il suo modello, es. il <title> dei temi a blocchi)
		nutrex_headless_remove_title_tags();
		nutrex_headless_clean_frame();
		return dirname( __DIR__ ) . '/templates/checkout.php';
	},
	PHP_INT_MAX
);

/** Percorso locale del file di uno stile o script dal suo indirizzo ('' se sta su un altro dominio). */
function nutrex_headless_asset_file( $src ) {
	$src     = (string) $src;
	$host    = (string) wp_parse_url( $src, PHP_URL_HOST );
	$content = wp_parse_url( content_url() );
	$hosts   = array_filter( array( $content['host'] ?? '', wp_parse_url( site_url(), PHP_URL_HOST ), wp_parse_url( home_url(), PHP_URL_HOST ) ) );
	if ( $host && ! in_array( strtolower( $host ), array_map( 'strtolower', $hosts ), true ) ) {
		return '';
	}
	$path         = (string) wp_parse_url( $src, PHP_URL_PATH );
	$content_path = rtrim( (string) ( $content['path'] ?? '/wp-content' ), '/' );
	if ( '' !== $content_path && 0 === strpos( $path, $content_path . '/' ) ) {
		return wp_normalize_path( WP_CONTENT_DIR ) . substr( $path, strlen( $content_path ) );
	}
	$site_path = rtrim( (string) wp_parse_url( site_url(), PHP_URL_PATH ), '/' );
	if ( '' !== $site_path && 0 === strpos( $path, $site_path . '/' ) ) {
		$path = substr( $path, strlen( $site_path ) );
	}
	return wp_normalize_path( ABSPATH ) . ltrim( $path, '/' );
}

add_action(
	'wp_enqueue_scripts',
	function () {
		if ( ! nutrex_headless_look() ) {
			return;
		}
		// via gli stili del tema e delle personalizzazioni di questo sito: la pagina usa quelli di
		// WooCommerce, dei metodi di pagamento e di Nutrex
		$styles = wp_styles();
		foreach ( $styles->queue as $handle ) {
			if ( ! isset( $styles->registered[ $handle ] ) ) {
				continue;
			}
			$src = (string) $styles->registered[ $handle ]->src;
			if ( '' === $src ) {
				// senza file (solo CSS in linea, o il foglio unito dalla cache del sito): si tengono quelli
				// di WordPress, WooCommerce, metodi di pagamento e cache; via quelli del tema e del codice aggiunto
				$keep = (bool) preg_match( '/^(wp-|wc|woocommerce|global-styles|classic-theme-styles|core-block|nutrex-|siteground|sgo|sg-|stripe|klarna|paypal|ppcp|satispay|scalapay|nexi|mollie|braintree|square|amazon)/', $handle );
			} else {
				$file = nutrex_headless_asset_file( $src );
				$keep = '' === $file || nutrex_headless_is_essential( $file );
			}
			if ( ! $keep ) {
				wp_dequeue_style( $handle );
			}
		}
		// il CSS in linea che il tema del sito aggancia ai fogli di WooCommerce (es. Astra: colonne strette,
		// bordi e colori del checkout): via, qui vale il foglio di Nutrex
		foreach ( array( 'woocommerce-general', 'woocommerce-layout', 'woocommerce-smallscreen' ) as $handle ) {
			if ( isset( $styles->registered[ $handle ] ) ) {
				$styles->registered[ $handle ]->extra['after'] = array();
			}
		}
		// script: via solo quelli del tema e del codice aggiunto al sito (quelli dei plugin restano)
		$scripts = wp_scripts();
		$plugins = wp_normalize_path( WP_PLUGIN_DIR ) . '/';
		foreach ( $scripts->queue as $handle ) {
			$src  = isset( $scripts->registered[ $handle ] ) ? (string) $scripts->registered[ $handle ]->src : '';
			$file = '' === $src ? '' : nutrex_headless_asset_file( $src );
			if ( '' !== $file && ! nutrex_headless_is_essential( $file ) && 0 !== strpos( $file, $plugins ) ) {
				wp_dequeue_script( $handle );
			}
		}
		wp_enqueue_style( 'nutrex-headless-checkout', nutrex_headless_asset( 'checkout.css' ), array(), NUTREX_HEADLESS_VERSION );
	},
	PHP_INT_MAX
);

// i fogli di stile di WooCommerce, anche se il tema li sostituisce con i suoi
add_filter(
	'woocommerce_enqueue_styles',
	function ( $styles ) {
		if ( ! nutrex_headless_look() ) {
			return $styles;
		}
		$base = WC()->plugin_url() . '/assets/css/';
		return array(
			'woocommerce-layout'      => array( 'src' => $base . 'woocommerce-layout.css', 'deps' => '', 'version' => WC()->version, 'media' => 'all', 'has_rtl' => true ),
			'woocommerce-smallscreen' => array( 'src' => $base . 'woocommerce-smallscreen.css', 'deps' => 'woocommerce-layout', 'version' => WC()->version, 'media' => 'only screen and (max-width: 768px)', 'has_rtl' => true ),
			'woocommerce-general'     => array( 'src' => $base . 'woocommerce.css', 'deps' => '', 'version' => WC()->version, 'media' => 'all', 'has_rtl' => true ),
		);
	},
	PHP_INT_MAX
);

// titolo della scheda del browser e icona
add_filter(
	'pre_get_document_title',
	function ( $title ) {
		$titles = array(
			'checkout' => __( 'Pagamento sicuro', 'nutrex-headless' ),
			'received' => __( 'Ordine ricevuto', 'nutrex-headless' ),
			'pay'      => __( 'Pagamento dell\'ordine', 'nutrex-headless' ),
		);
		$look = nutrex_headless_look();
		return $look ? $titles[ $look ] . ' | Nutrex Lab' : $title;
	},
	PHP_INT_MAX
);

add_filter(
	'get_site_icon_url',
	function ( $url ) {
		return nutrex_headless_look() ? nutrex_headless_asset( 'nutrex-icon.svg' ) : $url;
	},
	PHP_INT_MAX
);

/** Titolo grande della pagina. */
function nutrex_headless_look_title() {
	$titles = array(
		'checkout' => __( 'Pagamento', 'nutrex-headless' ),
		'received' => __( 'Ordine ricevuto', 'nutrex-headless' ),
		'pay'      => __( 'Pagamento dell\'ordine', 'nutrex-headless' ),
	);
	return $titles[ nutrex_headless_look() ] ?? '';
}
