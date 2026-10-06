<?php
/**
 * Aspetto delle email Nutrex Lab: cornice (logo, scheda bianca, aiuto, pie' di pagina con i dati
 * dell'azienda), titoli e pulsanti. Tutto con gli stili scritti sugli elementi: si legge uguale in
 * Gmail, Apple Mail e Outlook, anche dove i fogli di stile vengono tolti. Lo usano i modelli delle
 * email degli ordini (templates/emails) e le email del modulo contatti.
 */

defined( 'ABSPATH' ) || exit;

/** Dati del marchio nelle email (si possono cambiare con il filtro nutrex_headless_mail_brand). */
function nutrex_headless_mail_brand() {
	$site = nutrex_headless_frontend_url();
	$site = $site ? $site : 'https://www.nutrexlab.it';
	return apply_filters(
		'nutrex_headless_mail_brand',
		array(
			'name'     => 'Nutrex Lab',
			'site'     => $site,
			'host'     => preg_replace( '#^https?://#', '', $site ),
			// immagini dal sito nutrexlab.it (cartella public/email); senza indirizzo del negozio, quelle del plugin
			'logo'     => nutrex_headless_frontend_url() ? $site . '/email/nutrex-logo.png' : nutrex_headless_asset( 'nutrex-logo-email.png' ),
			'mark'     => nutrex_headless_frontend_url() ? $site . '/email/nutrex-marchio.png' : '',
			'email'    => nutrex_headless_contact_address(),
			'whatsapp' => '393337192623',
			'company'  => 'Carlo Lappostato &middot; P.IVA IT02157850898 &middot; Via Iblea 97, 96010 Melilli (SR)',
			'links'    => array(
				'Privacy'              => '/privacy-policy',
				'Termini e condizioni' => '/termini-e-condizioni',
				'Spedizioni e resi'    => '/spedizioni-e-resi',
			),
		)
	);
}

/** Colori e caratteri (gli stessi del sito). */
define(
	'NUTREX_HEADLESS_MAIL',
	array(
		'ink'   => '#0e0c11',
		'text'  => '#3b3740',
		'muted' => '#7b7581',
		'line'  => '#e7e3ea',
		'bg'    => '#efedf1',
		'card'  => '#ffffff',
		'soft'  => '#f7f5f8',
		'berry' => '#9e2e65',
		'blush' => '#f6ebf1',
		'font'  => "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
	)
);

/** Stile in linea da coppie proprieta' => valore. */
function nutrex_headless_css( array $rules ) {
	$out = '';
	foreach ( $rules as $prop => $value ) {
		$out .= $prop . ':' . $value . ';';
	}
	return $out;
}

/** Apertura del documento: intestazione con il logo e inizio della scheda bianca. */
function nutrex_headless_mail_open( $title, $preheader = '' ) {
	$c = NUTREX_HEADLESS_MAIL;
	$b = nutrex_headless_mail_brand();
	ob_start();
	?>
<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title><?php echo esc_html( $title ); ?></title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800&amp;display=swap" rel="stylesheet">
<style>
:root { color-scheme: light; supported-color-schemes: light; }
@media screen and (max-width: 620px) {
	.nx-outer-cell { padding: 16px 10px 28px !important; }
	.nx-card { padding: 30px 22px !important; border-radius: 18px !important; }
	.nx-title { font-size: 30px !important; }
	.nx-col { display: block !important; width: 100% !important; padding: 0 0 20px !important; }
	.nx-meta td { display: block !important; width: 100% !important; padding: 0 0 12px !important; }
	.nx-thumb { width: 66px !important; }
	.nx-thumb img { width: 54px !important; height: 54px !important; }
	.nx-btn-cell { display: block !important; padding: 0 0 10px !important; }
}
</style>
</head>
<body style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0', 'padding' => '0', 'background' => $c['bg'], '-webkit-text-size-adjust' => '100%' ) ) ); ?>">
<?php if ( $preheader ) : ?>
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:<?php echo esc_attr( $c['bg'] ); ?>;"><?php echo esc_html( $preheader ); ?><?php echo str_repeat( '&#8203;&nbsp;', 60 ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></div>
<?php endif; ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="<?php echo esc_attr( $c['bg'] ); ?>" style="background:<?php echo esc_attr( $c['bg'] ); ?>;">
<tr>
<td align="center" class="nx-outer-cell" style="padding:36px 16px 40px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr>
<td style="padding:0 6px 22px;" align="left">
<a href="<?php echo esc_url( $b['site'] ); ?>" target="_blank" style="text-decoration:none;display:inline-block;"><img src="<?php echo esc_url( $b['logo'] ); ?>" width="150" alt="Nutrex Lab" style="display:block;width:150px;max-width:150px;height:auto;border:0;outline:none;"></a>
</td>
</tr>
<tr>
<td class="nx-card" bgcolor="<?php echo esc_attr( $c['card'] ); ?>" style="<?php echo esc_attr( nutrex_headless_css( array( 'background' => $c['card'], 'border' => '1px solid ' . $c['line'], 'border-radius' => '22px', 'padding' => '40px 44px', 'font-family' => $c['font'], 'color' => $c['text'], 'font-size' => '15px', 'line-height' => '1.6', 'text-align' => 'left' ) ) ); ?>">
	<?php
	return ob_get_clean();
}

/** Chiusura: fine della scheda, aiuto (con i pulsanti email e WhatsApp) e pie' di pagina. */
function nutrex_headless_mail_close( $help = true ) {
	$c     = NUTREX_HEADLESS_MAIL;
	$b     = nutrex_headless_mail_brand();
	$small = nutrex_headless_css( array( 'margin' => '0 0 8px', 'font-family' => $c['font'], 'font-size' => '12px', 'line-height' => '1.6', 'color' => $c['muted'] ) );
	$link  = nutrex_headless_css( array( 'color' => $c['muted'], 'text-decoration' => 'underline' ) );
	ob_start();
	if ( $help ) {
		echo nutrex_headless_mail_help(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
	?>
</td>
</tr>
<tr>
<td align="center" style="padding:30px 18px 0;">
<?php if ( $b['mark'] ) : ?>
<img src="<?php echo esc_url( $b['mark'] ); ?>" width="26" alt="" style="display:block;width:26px;height:auto;border:0;margin:0 auto 14px;">
<?php endif; ?>
<p style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0 0 10px', 'font-family' => $c['font'], 'font-size' => '13px', 'font-weight' => '700', 'letter-spacing' => '0.16em', 'text-transform' => 'uppercase', 'color' => $c['ink'] ) ) ); ?>">Nutrex Lab</p>
<p style="<?php echo esc_attr( $small ); ?>">Integratori alimentari &middot; Prodotto in Italia</p>
<p style="<?php echo esc_attr( $small ); ?>">
<a href="<?php echo esc_url( $b['site'] ); ?>" target="_blank" style="<?php echo esc_attr( $link ); ?>"><?php echo esc_html( $b['host'] ); ?></a>
<?php foreach ( $b['links'] as $label => $path ) : ?>
&nbsp;&middot;&nbsp; <a href="<?php echo esc_url( $b['site'] . $path ); ?>" target="_blank" style="<?php echo esc_attr( $link ); ?>"><?php echo esc_html( $label ); ?></a>
<?php endforeach; ?>
</p>
<p style="<?php echo esc_attr( $small ); ?>"><?php echo wp_kses_post( $b['company'] ); ?></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
	<?php
	return ob_get_clean();
}

/** Documento completo: titolo per la scheda del programma di posta, anteprima, contenuto. */
function nutrex_headless_mail_document( $args ) {
	$args = wp_parse_args( $args, array( 'title' => 'Nutrex Lab', 'preheader' => '', 'body' => '', 'help' => true ) );
	return nutrex_headless_mail_open( $args['title'], $args['preheader'] ) . $args['body'] . nutrex_headless_mail_close( $args['help'] );
}

/** Apertura del messaggio: soprattitolo, titolo grande, paragrafi, pulsante facoltativo. */
function nutrex_headless_mail_hero( $eyebrow, $title, array $lines = array(), $button = null ) {
	$c = NUTREX_HEADLESS_MAIL;
	ob_start();
	?>
<p style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0 0 14px', 'font-family' => $c['font'], 'font-size' => '11px', 'font-weight' => '700', 'letter-spacing' => '0.2em', 'text-transform' => 'uppercase', 'color' => $c['berry'] ) ) ); ?>"><?php echo esc_html( $eyebrow ); ?></p>
<h1 class="nx-title" style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0 0 16px', 'font-family' => $c['font'], 'font-size' => '34px', 'line-height' => '1.08', 'font-weight' => '800', 'letter-spacing' => '-0.02em', 'color' => $c['ink'] ) ) ); ?>"><?php echo esc_html( $title ); ?></h1>
	<?php foreach ( $lines as $line ) : ?>
<p style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0 0 12px', 'font-family' => $c['font'], 'font-size' => '16px', 'line-height' => '1.6', 'color' => $c['text'] ) ) ); ?>"><?php echo wp_kses_post( $line ); ?></p>
	<?php endforeach; ?>
	<?php
	if ( $button ) {
		echo '<div style="padding-top:12px;">' . nutrex_headless_mail_button( $button['label'], $button['url'] ) . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
	return ob_get_clean();
}

/** Pulsante a pillola (anche in Outlook, dove resta rettangolare). */
function nutrex_headless_mail_button( $label, $url, $dark = true ) {
	$c     = NUTREX_HEADLESS_MAIL;
	$bg    = $dark ? $c['ink'] : $c['card'];
	$fg    = $dark ? '#ffffff' : $c['ink'];
	$style = nutrex_headless_css(
		array(
			'display'         => 'inline-block',
			'padding'         => '14px 26px',
			'border-radius'   => '999px',
			'background'      => $bg,
			'color'           => $fg,
			'border'          => '1px solid ' . ( $dark ? $c['ink'] : $c['line'] ),
			'font-family'     => $c['font'],
			'font-size'       => '13px',
			'font-weight'     => '700',
			'letter-spacing'  => '0.08em',
			'text-transform'  => 'uppercase',
			'text-decoration' => 'none',
		)
	);
	return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr><td style="border-radius:999px;" bgcolor="' . esc_attr( $bg ) . '"><a href="' . esc_url( $url ) . '" target="_blank" style="' . esc_attr( $style ) . '">' . esc_html( $label ) . '&nbsp;&nbsp;&rarr;</a></td></tr></table>';
}

/** Riquadro "Hai bisogno di aiuto?" con email e WhatsApp. */
function nutrex_headless_mail_help() {
	$c = NUTREX_HEADLESS_MAIL;
	$b = nutrex_headless_mail_brand();
	ob_start();
	?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:34px;">
<tr>
<td bgcolor="<?php echo esc_attr( $c['blush'] ); ?>" style="<?php echo esc_attr( nutrex_headless_css( array( 'background' => $c['blush'], 'border-radius' => '16px', 'padding' => '24px 26px' ) ) ); ?>">
<p style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0 0 6px', 'font-family' => $c['font'], 'font-size' => '17px', 'font-weight' => '800', 'color' => $c['ink'] ) ) ); ?>">Hai bisogno di aiuto?</p>
<p style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0 0 16px', 'font-family' => $c['font'], 'font-size' => '14px', 'line-height' => '1.55', 'color' => $c['text'] ) ) ); ?>">Rispondi a questa email oppure scrivici: ti risponde il team di Nutrex Lab.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="nx-btn-cell" style="padding:0 10px 0 0;"><?php echo nutrex_headless_mail_button( 'Scrivici', 'mailto:' . $b['email'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></td>
<?php if ( $b['whatsapp'] ) : ?>
<td class="nx-btn-cell"><?php echo nutrex_headless_mail_button( 'WhatsApp', 'https://wa.me/' . rawurlencode( $b['whatsapp'] ), false ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></td>
<?php endif; ?>
</tr>
</table>
</td>
</tr>
</table>
	<?php
	return ob_get_clean();
}

/** Etichetta di sezione (maiuscoletto spaziato). */
function nutrex_headless_mail_label( $text, $align = 'left' ) {
	$c = NUTREX_HEADLESS_MAIL;
	return '<p style="' . esc_attr( nutrex_headless_css( array( 'margin' => '0 0 10px', 'font-family' => $c['font'], 'font-size' => '11px', 'font-weight' => '700', 'letter-spacing' => '0.18em', 'text-transform' => 'uppercase', 'color' => $c['muted'], 'text-align' => $align ) ) ) . '">' . wp_kses_post( $text ) . '</p>';
}
