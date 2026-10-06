<?php
/**
 * Impostazioni: WooCommerce > Impostazioni > Avanzate > Nutrex Lab.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'woocommerce_get_sections_advanced',
	function ( $sections ) {
		$sections['nutrex'] = __( 'Nutrex Lab', 'nutrex-headless' );
		return $sections;
	}
);

add_filter(
	'woocommerce_get_settings_advanced',
	function ( $settings, $section ) {
		if ( 'nutrex' !== $section ) {
			return $settings;
		}
		return array(
			array(
				'title' => __( 'Negozio Nutrex Lab', 'nutrex-headless' ),
				'type'  => 'title',
				'desc'  => __( 'Il negozio nutrexlab.it mostra i prodotti della categoria indicata qui sotto. Per pagare, i clienti arrivano alla pagina di pagamento di Nutrex Lab (una pagina sua, creata dal plugin) con gli stessi prodotti; dopo il pagamento tornano su nutrexlab.it. I due negozi restano separati: i prodotti Nutrex non compaiono e non si comprano su questo sito, carrelli e ordini non si mescolano. Pagine, carrello e checkout di questo sito non cambiano.', 'nutrex-headless' ),
				'id'    => 'nutrex_headless',
			),
			array(
				'title'       => __( 'Indirizzo del negozio', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_frontend_url',
				'type'        => 'text',
				'placeholder' => 'https://www.nutrexlab.it',
				'desc_tip'    => __( 'Solo il dominio, es. https://www.nutrexlab.it. Dopo il pagamento di un ordine Nutrex il cliente torna qui; i link dei prodotti Nutrex (anche nelle email) portano qui.', 'nutrex-headless' ),
			),
			array(
				'title'       => __( 'Categoria dei prodotti Nutrex', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_category',
				'type'        => 'text',
				'placeholder' => 'nutrex-lab',
				'desc_tip'    => __( 'Lo slug della categoria (come WOOCOMMERCE_CATEGORY su Vercel). Vale anche per le sue sottocategorie.', 'nutrex-headless' ),
			),
			array(
				'type' => 'nutrex_checkout_page',
				'id'   => 'nutrex_headless_checkout_page_info',
			),
			array(
				'type' => 'nutrex_account_page',
				'id'   => 'nutrex_headless_account_page_info',
			),
			array(
				'type' => 'sectionend',
				'id'   => 'nutrex_headless',
			),

			array(
				'title' => __( 'Email di Nutrex Lab', 'nutrex-headless' ),
				'type'  => 'title',
				'desc'  => __( 'Le email degli ordini Nutrex e i messaggi del modulo contatti di nutrexlab.it partono dalla casella info@nutrexlab.it attraverso il suo server di posta: arrivano firmate dal dominio nutrexlab.it e non finiscono nello spam. Basta inserire la password della casella, salvare e inviare l\'email di prova. Le altre email di questo sito non cambiano.', 'nutrex-headless' ),
				'id'    => 'nutrex_headless_mail',
			),
			array(
				'title'    => __( 'Casella email', 'nutrex-headless' ),
				'id'       => 'nutrex_headless_smtp_user',
				'type'     => 'email',
				'default'  => NUTREX_HEADLESS_SMTP_DEFAULTS['user'],
				'desc_tip' => __( 'Mittente delle email Nutrex e utente del server di posta.', 'nutrex-headless' ),
			),
			array(
				'title'    => __( 'Password della casella', 'nutrex-headless' ),
				'id'       => 'nutrex_headless_smtp_pass',
				'type'     => 'nutrex_password',
				'desc_tip' => __( 'La stessa che si usa per leggere la posta di info@nutrexlab.it. Viene salvata cifrata; lascia il campo vuoto per non cambiarla.', 'nutrex-headless' ),
			),
			array(
				'title'    => __( 'Server di posta (SMTP)', 'nutrex-headless' ),
				'id'       => 'nutrex_headless_smtp_host',
				'type'     => 'text',
				'default'  => NUTREX_HEADLESS_SMTP_DEFAULTS['host'],
				'desc_tip' => __( 'Il server di posta di nutrexlab.it (VHosting).', 'nutrex-headless' ),
			),
			array(
				'title'   => __( 'Sicurezza e porta', 'nutrex-headless' ),
				'id'      => 'nutrex_headless_smtp_secure',
				'type'    => 'select',
				'default' => NUTREX_HEADLESS_SMTP_DEFAULTS['secure'],
				'options' => array(
					'tls' => __( 'STARTTLS, porta 587 (consigliata)', 'nutrex-headless' ),
					'ssl' => __( 'SSL, porta 465', 'nutrex-headless' ),
				),
			),
			array(
				'title'       => __( 'Messaggi del modulo contatti a', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_contact_to',
				'type'        => 'email',
				'placeholder' => 'info@nutrexlab.it',
				'desc_tip'    => __( 'Dove arrivano i messaggi scritti nella pagina Contatti di nutrexlab.it. Vuoto: la casella qui sopra.', 'nutrex-headless' ),
			),
			array(
				'title'       => __( 'Notifiche degli ordini Nutrex a', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_orders_to',
				'type'        => 'email',
				'placeholder' => 'info@nutrexlab.it',
				'desc_tip'    => __( 'Dove arrivano "Nuovo ordine", ordini annullati o non riusciti e avvisi di magazzino dei prodotti Nutrex, al posto degli indirizzi di questo sito. Vuoto: la casella dei messaggi del modulo contatti.', 'nutrex-headless' ),
			),
			array(
				'title'       => __( 'Nome del mittente', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_email_from_name',
				'type'        => 'text',
				'placeholder' => 'Nutrex Lab',
				'desc_tip'    => __( 'Vuoto: "Nutrex Lab".', 'nutrex-headless' ),
			),
			array(
				'title'    => __( 'Indirizzo mittente diverso', 'nutrex-headless' ),
				'id'       => 'nutrex_headless_email_from_address',
				'type'     => 'email',
				'desc_tip' => __( 'Di solito vuoto: si usa la casella qui sopra. Un altro indirizzo deve essere dello stesso dominio e poter inviare da quella casella.', 'nutrex-headless' ),
			),
			array(
				'type' => 'nutrex_mail_status',
				'id'   => 'nutrex_headless_mail_status',
			),
			array(
				'type' => 'sectionend',
				'id'   => 'nutrex_headless_mail',
			),
		);
	},
	10,
	2
);

// la pagina di pagamento di Nutrex Lab (creata dal plugin)
add_action(
	'woocommerce_admin_field_nutrex_checkout_page',
	function () {
		$id = nutrex_headless_ensure_checkout_page();
		?>
		<tr valign="top">
			<th scope="row" class="titledesc"><?php esc_html_e( 'Pagina di pagamento Nutrex', 'nutrex-headless' ); ?></th>
			<td class="forminp">
				<?php if ( $id ) : ?>
					<a href="<?php echo esc_url( get_permalink( $id ) ); ?>" target="_blank" rel="noopener"><?php echo esc_html( get_permalink( $id ) ); ?></a>
					<p class="description"><?php esc_html_e( 'Creata dal plugin, solo per i clienti di nutrexlab.it: non compare nei menu e nelle ricerche di questo sito. Non modificarla e non cancellarla (se manca, il plugin la ricrea).', 'nutrex-headless' ); ?></p>
				<?php else : ?>
					<p class="description"><?php esc_html_e( 'Pagina non ancora creata: imposta la categoria dei prodotti Nutrex e salva.', 'nutrex-headless' ); ?></p>
				<?php endif; ?>
			</td>
		</tr>
		<?php
	}
);

// l'area clienti di Nutrex Lab (creata dal plugin)
add_action(
	'woocommerce_admin_field_nutrex_account_page',
	function () {
		$id = nutrex_headless_category_ids() ? nutrex_headless_ensure_account_page() : nutrex_headless_account_page_id();
		?>
		<tr valign="top">
			<th scope="row" class="titledesc"><?php esc_html_e( 'Area clienti Nutrex', 'nutrex-headless' ); ?></th>
			<td class="forminp">
				<?php if ( $id ) : ?>
					<a href="<?php echo esc_url( get_permalink( $id ) ); ?>" target="_blank" rel="noopener"><?php echo esc_html( get_permalink( $id ) ); ?></a>
					<p class="description"><?php esc_html_e( 'Accesso, registrazione, ordini Nutrex, indirizzi; sconto del 5% sul primo ordine e "invita un amico" (WooCommerce > Nutrex Lab: inviti). Su nutrexlab.it e\' la pagina /account. Non modificarla e non cancellarla.', 'nutrex-headless' ); ?></p>
				<?php else : ?>
					<p class="description"><?php esc_html_e( 'Pagina non ancora creata: imposta la categoria dei prodotti Nutrex e salva.', 'nutrex-headless' ); ?></p>
				<?php endif; ?>
			</td>
		</tr>
		<?php
	}
);

// password della casella: campo vuoto (mai riscritta nella pagina), salvata cifrata, vuoto = non cambia
add_action(
	'woocommerce_admin_field_nutrex_password',
	function ( $field ) {
		$saved = '' !== (string) get_option( $field['id'], '' );
		?>
		<tr valign="top">
			<th scope="row" class="titledesc">
				<label for="<?php echo esc_attr( $field['id'] ); ?>"><?php echo esc_html( $field['title'] ); ?> <?php echo wc_help_tip( $field['desc_tip'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></label>
			</th>
			<td class="forminp">
				<input name="<?php echo esc_attr( $field['id'] ); ?>" id="<?php echo esc_attr( $field['id'] ); ?>" type="password" autocomplete="new-password" value="" style="min-width:300px;" placeholder="<?php echo esc_attr( $saved ? __( '•••••••• (salvata)', 'nutrex-headless' ) : '' ); ?>" />
			</td>
		</tr>
		<?php
	}
);

add_filter(
	'woocommerce_admin_settings_sanitize_option_nutrex_headless_smtp_pass',
	function ( $value, $option, $raw ) {
		$raw = is_string( $raw ) ? $raw : '';
		return '' === $raw ? get_option( 'nutrex_headless_smtp_pass', '' ) : nutrex_headless_secret_write( $raw );
	},
	10,
	3
);

// stato dell'invio e pulsante per l'email di prova
add_action(
	'woocommerce_admin_field_nutrex_mail_status',
	function () {
		$smtp   = nutrex_headless_smtp();
		$error  = get_option( 'nutrex_headless_smtp_error' );
		$ok     = (int) get_option( 'nutrex_headless_smtp_ok', 0 );
		$result = get_transient( 'nutrex_headless_test_' . get_current_user_id() );
		delete_transient( 'nutrex_headless_test_' . get_current_user_id() );
		$test = wp_nonce_url( admin_url( 'admin-post.php?action=nutrex_headless_test_email' ), 'nutrex_headless_test_email' );
		?>
		<tr valign="top">
			<th scope="row" class="titledesc"><?php esc_html_e( 'Stato', 'nutrex-headless' ); ?></th>
			<td class="forminp">
				<?php if ( $result ) : ?>
					<div class="notice inline <?php echo $result['ok'] ? 'notice-success' : 'notice-error'; ?>" style="margin:0 0 12px;"><p><?php echo esc_html( $result['message'] ); ?></p></div>
				<?php endif; ?>
				<p>
					<?php
					if ( ! $smtp ) {
						esc_html_e( 'Password non inserita: le email Nutrex partono con il mittente normale di questo sito.', 'nutrex-headless' );
					} elseif ( $error && ( ! $ok || $error['time'] > $ok ) ) {
						/* translators: 1: data, 2: errore */
						printf( esc_html__( 'Ultimo invio non riuscito (%1$s): %2$s. Le email sono partite con il mittente normale del sito.', 'nutrex-headless' ), esc_html( wp_date( 'j F Y, H:i', $error['time'] ) ), esc_html( $error['message'] ) );
					} elseif ( $ok ) {
						/* translators: %s: data */
						printf( esc_html__( 'Tutto a posto: ultimo invio da %1$s il %2$s.', 'nutrex-headless' ), esc_html( $smtp['user'] ), esc_html( wp_date( 'j F Y, H:i', $ok ) ) );
					} else {
						esc_html_e( 'Pronto: invia l\'email di prova per controllare.', 'nutrex-headless' );
					}
					?>
				</p>
				<p style="margin-top:10px;">
					<a class="button" href="<?php echo esc_url( $test ); ?>"><?php esc_html_e( 'Invia un\'email di prova', 'nutrex-headless' ); ?></a>
					<span class="description" style="margin-left:8px;"><?php printf( esc_html__( 'Arriva a %s. Salva prima le modifiche.', 'nutrex-headless' ), esc_html( nutrex_headless_contact_address() ) ); ?></span>
				</p>
			</td>
		</tr>
		<?php
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( dirname( __DIR__ ) . '/nutrex-headless.php' ),
	function ( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=wc-settings&tab=advanced&section=nutrex' ) ) . '">' . esc_html__( 'Impostazioni', 'nutrex-headless' ) . '</a>' );
		return $links;
	}
);
