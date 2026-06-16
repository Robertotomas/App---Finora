/**
 * Mapeamento Nome -> Dominio para logos de marcas (bancos, supermercados, lojas).
 * Fonte dos logos: Clearbit -> favicon Google -> icone generico (ver BrandLogo.vue).
 * Apenas camada visual; o entityName/account.name continua a ser texto livre.
 */

export type BrandType = 'bank' | 'store' | 'other'

export interface Brand {
  /** Nome a apresentar (e termo principal de match). */
  name: string
  /** Dominio usado para Clearbit/favicon. */
  domain: string
  type: BrandType
  /** Termos alternativos de match (normalizados em runtime). */
  aliases?: string[]
  /** Pais do banco (ISO-3166 alpha-2 minusculas) ou 'global' para fintechs. So usado em type 'bank'. */
  country?: string
  /** Banco destacado no seletor de contas ("Mais populares"). */
  popular?: boolean
}

export const BRANDS: Brand[] = [
  // ───────── Bancos ─────────
  // Portugal
  { name: 'Caixa Geral de Depósitos', domain: 'cgd.pt', type: 'bank', country: 'pt', popular: true, aliases: ['cgd', 'caixa', 'caixa geral'] },
  { name: 'Santander', domain: 'santander.pt', type: 'bank', country: 'pt', popular: true, aliases: ['santander totta'] },
  { name: 'Millennium BCP', domain: 'millenniumbcp.pt', type: 'bank', country: 'pt', popular: true, aliases: ['millennium', 'bcp'] },
  { name: 'Novobanco', domain: 'novobanco.pt', type: 'bank', country: 'pt', popular: true, aliases: ['novo banco'] },
  { name: 'ActivoBank', domain: 'activobank.pt', type: 'bank', country: 'pt', popular: true, aliases: ['activo bank'] },
  { name: 'Banco BPI', domain: 'bancobpi.pt', type: 'bank', country: 'pt', aliases: ['bpi'] },
  { name: 'Banco CTT', domain: 'bancoctt.pt', type: 'bank', country: 'pt' },
  { name: 'Crédito Agrícola', domain: 'creditoagricola.pt', type: 'bank', country: 'pt', aliases: ['credito agricola', 'ca'] },
  { name: 'Montepio', domain: 'montepio.pt', type: 'bank', country: 'pt' },
  { name: 'EuroBic', domain: 'eurobic.pt', type: 'bank', country: 'pt', aliases: ['bic'] },
  { name: 'Banco BIG', domain: 'big.pt', type: 'bank', country: 'pt' },
  { name: 'Banco Best', domain: 'bancobest.pt', type: 'bank', country: 'pt', aliases: ['best'] },
  { name: 'Banco Atlântico Europa', domain: 'bancoatlantico.pt', type: 'bank', country: 'pt', aliases: ['atlantico'] },
  { name: 'Abanca', domain: 'abanca.pt', type: 'bank', country: 'pt' },

  // Espanha
  { name: 'BBVA', domain: 'bbva.com', type: 'bank', country: 'es', popular: true },
  { name: 'CaixaBank', domain: 'caixabank.es', type: 'bank', country: 'es', popular: true },
  { name: 'Banco Santander', domain: 'bancosantander.es', type: 'bank', country: 'es', popular: true, aliases: ['santander espanha'] },
  { name: 'Banco Sabadell', domain: 'bancsabadell.com', type: 'bank', country: 'es', popular: true, aliases: ['sabadell'] },
  { name: 'Bankinter', domain: 'bankinter.com', type: 'bank', country: 'es', popular: true },
  { name: 'Unicaja Banco', domain: 'unicajabanco.es', type: 'bank', country: 'es', aliases: ['unicaja'] },
  { name: 'Kutxabank', domain: 'kutxabank.es', type: 'bank', country: 'es' },
  { name: 'Ibercaja', domain: 'ibercaja.es', type: 'bank', country: 'es' },
  { name: 'ING España', domain: 'ing.es', type: 'bank', country: 'es' },

  // França
  { name: 'BNP Paribas', domain: 'bnpparibas.fr', type: 'bank', country: 'fr', popular: true, aliases: ['bnp'] },
  { name: 'Crédit Agricole', domain: 'credit-agricole.fr', type: 'bank', country: 'fr', popular: true },
  { name: 'Société Générale', domain: 'societegenerale.fr', type: 'bank', country: 'fr', popular: true },
  { name: 'Boursorama', domain: 'boursorama.com', type: 'bank', country: 'fr', popular: true },
  { name: 'Banque Populaire', domain: 'banquepopulaire.fr', type: 'bank', country: 'fr' },
  { name: 'Crédit Mutuel', domain: 'creditmutuel.fr', type: 'bank', country: 'fr' },
  { name: 'La Banque Postale', domain: 'labanquepostale.fr', type: 'bank', country: 'fr' },
  { name: "Caisse d'Epargne", domain: 'caisse-epargne.fr', type: 'bank', country: 'fr' },

  // Alemanha
  { name: 'Deutsche Bank', domain: 'deutsche-bank.de', type: 'bank', country: 'de', popular: true },
  { name: 'Commerzbank', domain: 'commerzbank.de', type: 'bank', country: 'de', popular: true },
  { name: 'DKB', domain: 'dkb.de', type: 'bank', country: 'de', popular: true },
  { name: 'Sparkasse', domain: 'sparkasse.de', type: 'bank', country: 'de', popular: true },
  { name: 'Comdirect', domain: 'comdirect.de', type: 'bank', country: 'de' },
  { name: 'ING', domain: 'ing.de', type: 'bank', country: 'de' },
  { name: 'Postbank', domain: 'postbank.de', type: 'bank', country: 'de' },

  // Reino Unido
  { name: 'Barclays', domain: 'barclays.co.uk', type: 'bank', country: 'gb', popular: true },
  { name: 'HSBC', domain: 'hsbc.co.uk', type: 'bank', country: 'gb', popular: true },
  { name: 'Lloyds Bank', domain: 'lloydsbank.com', type: 'bank', country: 'gb', popular: true, aliases: ['lloyds'] },
  { name: 'Monzo', domain: 'monzo.com', type: 'bank', country: 'gb', popular: true },
  { name: 'Starling Bank', domain: 'starlingbank.com', type: 'bank', country: 'gb', aliases: ['starling'] },
  { name: 'NatWest', domain: 'natwest.com', type: 'bank', country: 'gb' },
  { name: 'Santander UK', domain: 'santander.co.uk', type: 'bank', country: 'gb' },
  { name: 'Halifax', domain: 'halifax.co.uk', type: 'bank', country: 'gb' },

  // Fintechs globais (aparecem em qualquer pais)
  { name: 'Revolut', domain: 'revolut.com', type: 'bank', country: 'global', popular: true },
  { name: 'N26', domain: 'n26.com', type: 'bank', country: 'global', popular: true },
  { name: 'Wise', domain: 'wise.com', type: 'bank', country: 'global', aliases: ['transferwise'] },
  { name: 'PayPal', domain: 'paypal.com', type: 'bank', country: 'global' },
  { name: 'bunq', domain: 'bunq.com', type: 'bank', country: 'global' },

  // ───────── Supermercados / lojas (para movimentos) ─────────
  { name: 'Continente', domain: 'continente.pt', type: 'store' },
  { name: 'Pingo Doce', domain: 'pingodoce.pt', type: 'store', aliases: ['pingodoce'] },
  { name: 'Lidl', domain: 'lidl.pt', type: 'store', aliases: ['lidl portugal'] },
  { name: 'Aldi', domain: 'aldi.pt', type: 'store' },
  { name: 'Auchan', domain: 'auchan.pt', type: 'store', aliases: ['jumbo'] },
  { name: 'Intermarché', domain: 'intermarche.pt', type: 'store', aliases: ['intermarche'] },
  { name: 'Minipreço', domain: 'minipreco.pt', type: 'store', aliases: ['minipreco', 'dia'] },
  { name: 'Mercadona', domain: 'mercadona.pt', type: 'store' },
  { name: 'El Corte Inglés', domain: 'elcorteingles.pt', type: 'store', aliases: ['el corte ingles', 'corte ingles'] },
  { name: 'Worten', domain: 'worten.pt', type: 'store' },
  { name: 'Fnac', domain: 'fnac.pt', type: 'store' },
  { name: 'IKEA', domain: 'ikea.com', type: 'store' },
  { name: 'Decathlon', domain: 'decathlon.pt', type: 'store' },
  { name: 'Primark', domain: 'primark.com', type: 'store' },
  { name: 'Zara', domain: 'zara.com', type: 'store' },
  { name: 'Amazon', domain: 'amazon.com', type: 'store', aliases: ['amazon.es', 'amzn'] },
  { name: 'Leroy Merlin', domain: 'leroymerlin.pt', type: 'store' },
  { name: 'E.Leclerc', domain: 'e-leclerc.pt', type: 'store', aliases: ['leclerc'] },
  { name: 'Makro', domain: 'makro.pt', type: 'store' },
  // Tecnologia / eletrónica
  { name: 'PC Diga', domain: 'pcdiga.com', type: 'store', aliases: ['pcdiga', 'pc diga'] },
  { name: 'Rádio Popular', domain: 'radiopopular.pt', type: 'store', aliases: ['radio popular'] },
  { name: 'MediaMarkt', domain: 'mediamarkt.pt', type: 'store', aliases: ['media markt'] },
  { name: 'Globaldata', domain: 'globaldata.pt', type: 'store' },
  // Moda / desporto
  { name: 'H&M', domain: 'hm.com', type: 'store', aliases: ['hm', 'h e m'] },
  { name: 'Pull&Bear', domain: 'pullandbear.com', type: 'store', aliases: ['pull and bear', 'pull bear'] },
  { name: 'Bershka', domain: 'bershka.com', type: 'store' },
  { name: 'Stradivarius', domain: 'stradivarius.com', type: 'store' },
  { name: 'Mango', domain: 'mango.com', type: 'store' },
  { name: 'Springfield', domain: 'myspringfield.com', type: 'store' },
  { name: 'Parfois', domain: 'parfois.com', type: 'store' },
  { name: 'Sport Zone', domain: 'sportzone.pt', type: 'store', aliases: ['sport zone'] },
  { name: 'JD Sports', domain: 'jdsports.pt', type: 'store', aliases: ['jd', 'jd sports'] },
  { name: 'Nike', domain: 'nike.com', type: 'store' },
  { name: 'Adidas', domain: 'adidas.com', type: 'store' },
  // Casa / bricolage
  { name: 'Conforama', domain: 'conforama.pt', type: 'store' },
  { name: 'AKI', domain: 'aki.pt', type: 'store' },
  { name: 'Maxmat', domain: 'maxmat.pt', type: 'store' },

  // ───────── Combustivel / energia / telecom / subscricoes ─────────
  { name: 'Galp', domain: 'galp.com', type: 'other' },
  { name: 'BP', domain: 'bp.com', type: 'other' },
  { name: 'Repsol', domain: 'repsol.com', type: 'other' },
  { name: 'EDP', domain: 'edp.pt', type: 'other' },
  { name: 'MEO', domain: 'meo.pt', type: 'other' },
  { name: 'NOS', domain: 'nos.pt', type: 'other' },
  { name: 'Vodafone', domain: 'vodafone.pt', type: 'other' },
  { name: 'Netflix', domain: 'netflix.com', type: 'other' },
  { name: 'Spotify', domain: 'spotify.com', type: 'other' },
  { name: 'Disney+', domain: 'disneyplus.com', type: 'other', aliases: ['disney plus', 'disney'] },
  { name: 'HBO Max', domain: 'hbomax.com', type: 'other', aliases: ['hbo', 'max'] },
  { name: 'YouTube', domain: 'youtube.com', type: 'other', aliases: ['youtube premium'] },
  { name: 'Apple', domain: 'apple.com', type: 'other', aliases: ['itunes', 'icloud', 'app store'] },
  { name: 'Google', domain: 'google.com', type: 'other', aliases: ['google one'] },
  { name: 'Microsoft', domain: 'microsoft.com', type: 'other', aliases: ['office', 'xbox'] },
  { name: 'Uber', domain: 'uber.com', type: 'other', aliases: ['uber eats'] },
  { name: 'Bolt', domain: 'bolt.eu', type: 'other' },
  { name: 'Glovo', domain: 'glovoapp.com', type: 'other' },

  // ───────── Combustível / bombas ─────────
  { name: 'Cepsa', domain: 'cepsa.pt', type: 'other' },
  { name: 'Prio', domain: 'prio.pt', type: 'other' },
  { name: 'Shell', domain: 'shell.pt', type: 'other' },
  { name: 'TotalEnergies', domain: 'totalenergies.pt', type: 'other', aliases: ['total'] },

  // ───────── Energia / utilities ─────────
  { name: 'Endesa', domain: 'endesa.pt', type: 'other' },
  { name: 'Iberdrola', domain: 'iberdrola.pt', type: 'other' },
  { name: 'Goldenergy', domain: 'goldenergy.pt', type: 'other' },
  { name: 'Águas de Portugal', domain: 'adp.pt', type: 'other', aliases: ['aguas', 'agua'] },

  // ───────── Telecom (extra) ─────────
  { name: 'NOWO', domain: 'nowo.pt', type: 'other' },
  { name: 'DIGI', domain: 'digi.pt', type: 'other' },

  // ───────── Restauração / fast food ─────────
  { name: "McDonald's", domain: 'mcdonalds.com', type: 'store', aliases: ['mcdonalds', 'mcdonald', 'mc donalds'] },
  { name: 'Burger King', domain: 'burgerking.pt', type: 'store', aliases: ['burger king'] },
  { name: 'KFC', domain: 'kfc.pt', type: 'store' },
  { name: 'Telepizza', domain: 'telepizza.pt', type: 'store' },
  { name: 'Pizza Hut', domain: 'pizzahut.pt', type: 'store', aliases: ['pizza hut'] },
  { name: 'Starbucks', domain: 'starbucks.com', type: 'store' },
  { name: 'h3', domain: 'h3.com', type: 'store' },

  // ───────── Carros (marcas) ─────────
  { name: 'Toyota', domain: 'toyota.com', type: 'other' },
  { name: 'Volkswagen', domain: 'volkswagen.com', type: 'other', aliases: ['vw'] },
  { name: 'Renault', domain: 'renault.com', type: 'other' },
  { name: 'Peugeot', domain: 'peugeot.com', type: 'other' },
  { name: 'Citroën', domain: 'citroen.com', type: 'other', aliases: ['citroen'] },
  { name: 'Mercedes-Benz', domain: 'mercedes-benz.com', type: 'other', aliases: ['mercedes'] },
  { name: 'BMW', domain: 'bmw.com', type: 'other' },
  { name: 'Audi', domain: 'audi.com', type: 'other' },
  { name: 'Ford', domain: 'ford.com', type: 'other' },
  { name: 'Tesla', domain: 'tesla.com', type: 'other' },
  { name: 'Fiat', domain: 'fiat.com', type: 'other' },
  { name: 'Opel', domain: 'opel.com', type: 'other' },
  { name: 'SEAT', domain: 'seat.com', type: 'other' },
  { name: 'Hyundai', domain: 'hyundai.com', type: 'other' },
  { name: 'Kia', domain: 'kia.com', type: 'other' },
  { name: 'Nissan', domain: 'nissan.pt', type: 'other' },
  { name: 'Dacia', domain: 'dacia.pt', type: 'other' },
  { name: 'Volvo', domain: 'volvocars.com', type: 'other', aliases: ['volvo'] },
  { name: 'Mazda', domain: 'mazda.pt', type: 'other' },
  { name: 'Mini', domain: 'mini.pt', type: 'other' },
  { name: 'Jeep', domain: 'jeep.com', type: 'other' },

  // ───────── Transportes / viagens ─────────
  { name: 'CP', domain: 'cp.pt', type: 'other', aliases: ['comboios'] },
  { name: 'Carris', domain: 'carris.pt', type: 'other' },
  { name: 'Metro de Lisboa', domain: 'metrolisboa.pt', type: 'other', aliases: ['metro lisboa'] },
  { name: 'Metro do Porto', domain: 'metrodoporto.pt', type: 'other', aliases: ['metro porto'] },
  { name: 'Cabify', domain: 'cabify.com', type: 'other' },
  { name: 'FlixBus', domain: 'flixbus.pt', type: 'other' },
  { name: 'TAP', domain: 'flytap.com', type: 'other', aliases: ['tap air portugal'] },
  { name: 'Ryanair', domain: 'ryanair.com', type: 'other' },
  { name: 'easyJet', domain: 'easyjet.com', type: 'other' },
  { name: 'Booking.com', domain: 'booking.com', type: 'other', aliases: ['booking'] },
  { name: 'Airbnb', domain: 'airbnb.com', type: 'other' },

  // ───────── Serviços digitais / subscrições ─────────
  { name: 'Amazon Prime', domain: 'primevideo.com', type: 'other', aliases: ['prime video', 'amazon prime'] },
  { name: 'Twitch', domain: 'twitch.tv', type: 'other' },
  { name: 'LinkedIn', domain: 'linkedin.com', type: 'other' },
  { name: 'Dropbox', domain: 'dropbox.com', type: 'other' },
  { name: 'Notion', domain: 'notion.so', type: 'other' },
  { name: 'Canva', domain: 'canva.com', type: 'other' },
  { name: 'OpenAI', domain: 'openai.com', type: 'other', aliases: ['chatgpt', 'chat gpt'] },
  { name: 'PlayStation', domain: 'playstation.com', type: 'other', aliases: ['psn', 'ps plus'] },
  { name: 'Steam', domain: 'steampowered.com', type: 'other' },
  { name: 'Nintendo', domain: 'nintendo.com', type: 'other' },

  // ───────── Supermercados / mercearia (extra) ─────────
  { name: 'Carrefour', domain: 'carrefour.es', type: 'store' },
  { name: 'Spar', domain: 'spar.pt', type: 'store' },
  { name: 'Froiz', domain: 'froiz.com', type: 'store' },
  { name: 'Apolónia', domain: 'apolonia.com', type: 'store' },
  { name: 'Eroski', domain: 'eroski.es', type: 'store' },
  { name: 'Consum', domain: 'consum.es', type: 'store' },

  // ───────── Cafés / padarias ─────────
  { name: 'A Padaria Portuguesa', domain: 'apadariaportuguesa.pt', type: 'store', aliases: ['padaria portuguesa'] },
  { name: 'Delta Cafés', domain: 'delta-cafes.pt', type: 'store', aliases: ['delta'] },
  { name: 'Nespresso', domain: 'nespresso.com', type: 'store' },
  { name: 'Subway', domain: 'subway.com', type: 'store' },
  { name: "Domino's Pizza", domain: 'dominos.pt', type: 'store', aliases: ['dominos'] },

  // ───────── Moda (extra) ─────────
  { name: 'Lefties', domain: 'lefties.com', type: 'store' },
  { name: 'Massimo Dutti', domain: 'massimodutti.com', type: 'store' },
  { name: 'Oysho', domain: 'oysho.com', type: 'store' },
  { name: 'Salsa', domain: 'salsajeans.com', type: 'store' },
  { name: 'Tiffosi', domain: 'tiffosi.com', type: 'store' },
  { name: 'C&A', domain: 'c-and-a.com', type: 'store' },
  { name: 'Calzedonia', domain: 'calzedonia.com', type: 'store' },
  { name: 'Intimissimi', domain: 'intimissimi.com', type: 'store' },

  // ───────── Beleza / perfumaria / saúde ─────────
  { name: 'Sephora', domain: 'sephora.pt', type: 'store' },
  { name: 'Douglas', domain: 'douglas.pt', type: 'store' },
  { name: 'Rituals', domain: 'rituals.com', type: 'store' },
  { name: 'Kiko Milano', domain: 'kikocosmetics.com', type: 'store', aliases: ['kiko'] },
  { name: 'Primor', domain: 'primor.eu', type: 'store' },
  { name: 'Wells', domain: 'wells.pt', type: 'store' },

  // ───────── Seguros / saúde / portagens ─────────
  { name: 'Fidelidade', domain: 'fidelidade.pt', type: 'other' },
  { name: 'Tranquilidade', domain: 'tranquilidade.pt', type: 'other' },
  { name: 'Ageas', domain: 'ageas.pt', type: 'other' },
  { name: 'Allianz', domain: 'allianz.pt', type: 'other' },
  { name: 'Médis', domain: 'medis.pt', type: 'other', aliases: ['medis'] },
  { name: 'Multicare', domain: 'multicare.pt', type: 'other' },
  { name: 'Via Verde', domain: 'viaverde.pt', type: 'other', aliases: ['via verde'] },
  { name: 'Brisa', domain: 'brisa.pt', type: 'other' },

  // ───────── Ginásios ─────────
  { name: 'Fitness Hut', domain: 'fitnesshut.pt', type: 'other', aliases: ['fitness hut'] },
  { name: 'Holmes Place', domain: 'holmesplace.pt', type: 'other', aliases: ['holmes place'] },
  { name: 'Solinca', domain: 'solinca.pt', type: 'other' },
  { name: 'Phive', domain: 'phive.pt', type: 'other' },

  // ───────── Carros (extra) ─────────
  { name: 'Škoda', domain: 'skoda.com', type: 'other', aliases: ['skoda'] },
  { name: 'Honda', domain: 'honda.pt', type: 'other' },
  { name: 'Suzuki', domain: 'suzuki.pt', type: 'other' },
  { name: 'Mitsubishi', domain: 'mitsubishi.pt', type: 'other' },
  { name: 'Land Rover', domain: 'landrover.com', type: 'other', aliases: ['land rover'] },
  { name: 'Jaguar', domain: 'jaguar.com', type: 'other' },
  { name: 'Porsche', domain: 'porsche.com', type: 'other' },
  { name: 'Lexus', domain: 'lexus.com', type: 'other' },
  { name: 'Cupra', domain: 'cupraofficial.com', type: 'other' },
  { name: 'Alfa Romeo', domain: 'alfaromeo.com', type: 'other', aliases: ['alfa romeo'] },

  // ───────── Marketplaces / compras online ─────────
  { name: 'AliExpress', domain: 'aliexpress.com', type: 'store', aliases: ['ali express'] },
  { name: 'Shein', domain: 'shein.com', type: 'store' },
  { name: 'Temu', domain: 'temu.com', type: 'store' },
  { name: 'eBay', domain: 'ebay.com', type: 'store' },
  { name: 'OLX', domain: 'olx.pt', type: 'store' },
  { name: 'Vinted', domain: 'vinted.pt', type: 'store' },
  { name: 'StandVirtual', domain: 'standvirtual.com', type: 'store', aliases: ['stand virtual'] },

  // ───────── Mobilidade / aluguer ─────────
  { name: 'Free Now', domain: 'free-now.com', type: 'other', aliases: ['freenow', 'free now'] },
  { name: 'Europcar', domain: 'europcar.pt', type: 'other' },
  { name: 'Hertz', domain: 'hertz.com', type: 'other' },
  { name: 'Guerin', domain: 'guerin.pt', type: 'other' },

  // ───────── Viagens / companhias aéreas (extra) ─────────
  { name: 'Iberia', domain: 'iberia.com', type: 'other' },
  { name: 'Lufthansa', domain: 'lufthansa.com', type: 'other' },
  { name: 'Vueling', domain: 'vueling.com', type: 'other' },
  { name: 'Wizz Air', domain: 'wizzair.com', type: 'other', aliases: ['wizz'] },
  { name: 'Expedia', domain: 'expedia.com', type: 'other' },
  { name: 'eDreams', domain: 'edreams.pt', type: 'other' },

  // ───────── Software / SaaS ─────────
  { name: 'GitHub', domain: 'github.com', type: 'other' },
  { name: 'Adobe', domain: 'adobe.com', type: 'other' },
  { name: 'Figma', domain: 'figma.com', type: 'other' },
  { name: 'Slack', domain: 'slack.com', type: 'other' },
  { name: 'Zoom', domain: 'zoom.us', type: 'other' },
  { name: 'NordVPN', domain: 'nordvpn.com', type: 'other' },
  { name: 'Duolingo', domain: 'duolingo.com', type: 'other' },
  { name: 'Udemy', domain: 'udemy.com', type: 'other' },

  // ───────── Streaming / áudio (extra) ─────────
  { name: 'SkyShowtime', domain: 'skyshowtime.com', type: 'other' },
  { name: 'Crunchyroll', domain: 'crunchyroll.com', type: 'other' },
  { name: 'Deezer', domain: 'deezer.com', type: 'other' },
  { name: 'Tidal', domain: 'tidal.com', type: 'other' },
  { name: 'Audible', domain: 'audible.com', type: 'other' },
  { name: 'Filmin', domain: 'filmin.pt', type: 'other' },

  // ───────── Cripto / investimento ─────────
  { name: 'Binance', domain: 'binance.com', type: 'other' },
  { name: 'Coinbase', domain: 'coinbase.com', type: 'other' },
  { name: 'Trading 212', domain: 'trading212.com', type: 'other', aliases: ['trading212'] },
  { name: 'eToro', domain: 'etoro.com', type: 'other' },
  { name: 'XTB', domain: 'xtb.com', type: 'other' },
  { name: 'DEGIRO', domain: 'degiro.com', type: 'other' },

  // ───────── Bancos / fintech (extra) ─────────
  { name: 'Banco Invest', domain: 'bancoinvest.pt', type: 'bank', country: 'pt' },
  { name: 'Bison Bank', domain: 'bisonbank.com', type: 'bank', country: 'pt' },
  { name: 'Moey', domain: 'moey.pt', type: 'bank', country: 'pt' },
  { name: 'Trade Republic', domain: 'traderepublic.com', type: 'bank', country: 'global', aliases: ['trade republic'] },
  { name: 'Vivid', domain: 'vivid.money', type: 'bank', country: 'global' },
  { name: 'Monese', domain: 'monese.com', type: 'bank', country: 'global' },

  // ───────── IA / ferramentas de IA ─────────
  { name: 'Claude', domain: 'claude.ai', type: 'other', aliases: ['anthropic'] },
  { name: 'Google Gemini', domain: 'gemini.google.com', type: 'other', aliases: ['gemini'] },
  { name: 'Microsoft Copilot', domain: 'copilot.microsoft.com', type: 'other', aliases: ['copilot'] },
  { name: 'Perplexity', domain: 'perplexity.ai', type: 'other' },
  { name: 'Midjourney', domain: 'midjourney.com', type: 'other' },
  { name: 'Grok', domain: 'x.ai', type: 'other', aliases: ['xai'] },
  { name: 'ElevenLabs', domain: 'elevenlabs.io', type: 'other', aliases: ['eleven labs'] },
  { name: 'Runway', domain: 'runwayml.com', type: 'other' },
  { name: 'Hugging Face', domain: 'huggingface.co', type: 'other', aliases: ['huggingface'] },
  { name: 'Mistral AI', domain: 'mistral.ai', type: 'other', aliases: ['mistral'] },
  { name: 'Suno', domain: 'suno.com', type: 'other' },

  // ───────── Seguros (extra) ─────────
  { name: 'Generali', domain: 'generali.pt', type: 'other' },
  { name: 'Zurich', domain: 'zurich.com', type: 'other' },
  { name: 'MetLife', domain: 'metlife.pt', type: 'other' },
  { name: 'Liberty Seguros', domain: 'libertyseguros.pt', type: 'other', aliases: ['liberty'] },
  { name: 'Lusitania Seguros', domain: 'lusitania.pt', type: 'other', aliases: ['lusitania'] },
  { name: 'Una Seguros', domain: 'una-seguros.pt', type: 'other', aliases: ['una'] },
  { name: 'Real Vida Seguros', domain: 'realvidaseguros.pt', type: 'other', aliases: ['real vida'] },
  { name: 'OK! teleseguros', domain: 'ok-seguros.pt', type: 'other', aliases: ['ok seguros'] },
  { name: 'Mapfre', domain: 'mapfre.pt', type: 'other' },
  { name: 'AXA', domain: 'axa.pt', type: 'other' },
  { name: 'Caravela Seguros', domain: 'caravelaseguros.pt', type: 'other', aliases: ['caravela'] },

  // ───────── Hospitais / saúde privada ─────────
  { name: 'CUF', domain: 'cuf.pt', type: 'other' },
  { name: 'Lusíadas Saúde', domain: 'lusiadas.pt', type: 'other', aliases: ['lusiadas'] },
  { name: 'Hospital da Luz', domain: 'hospitaldaluz.pt', type: 'other', aliases: ['hospital da luz', 'luz saude'] },
  { name: 'Trofa Saúde', domain: 'trofasaude.pt', type: 'other', aliases: ['trofa saude'] },
  { name: 'HPA Saúde', domain: 'grupohpa.com', type: 'other', aliases: ['hpa'] },
  { name: 'Joaquim Chaves Saúde', domain: 'joaquimchavesaude.pt', type: 'other', aliases: ['joaquim chaves'] },

  // ───────── Clubes de futebol (cotas / sócio) ─────────
  { name: 'SL Benfica', domain: 'slbenfica.pt', type: 'other', aliases: ['benfica', 'slb'] },
  { name: 'FC Porto', domain: 'fcporto.pt', type: 'other', aliases: ['porto', 'fcp'] },
  { name: 'Sporting CP', domain: 'sporting.pt', type: 'other', aliases: ['sporting', 'scp'] },
  { name: 'SC Braga', domain: 'scbraga.pt', type: 'other', aliases: ['braga'] },
  { name: 'Vitória SC', domain: 'vitoriasc.pt', type: 'other', aliases: ['vitoria', 'vitoria guimaraes'] },
  { name: 'Boavista FC', domain: 'boavistafc.pt', type: 'other', aliases: ['boavista'] },
  { name: 'Real Madrid', domain: 'realmadrid.com', type: 'other' },
  { name: 'FC Barcelona', domain: 'fcbarcelona.com', type: 'other', aliases: ['barcelona', 'barca'] },

  // ───────── Eletrónica / marcas tecnológicas ─────────
  { name: 'Samsung', domain: 'samsung.com', type: 'store' },
  { name: 'Xiaomi', domain: 'mi.com', type: 'store' },
  { name: 'Sony', domain: 'sony.com', type: 'store' },
  { name: 'LG', domain: 'lg.com', type: 'store' },
  { name: 'Huawei', domain: 'huawei.com', type: 'store' },
  { name: 'Dell', domain: 'dell.com', type: 'store' },
  { name: 'HP', domain: 'hp.com', type: 'store' },
  { name: 'Asus', domain: 'asus.com', type: 'store' },
  { name: 'Lenovo', domain: 'lenovo.com', type: 'store' },

  // ───────── Correios / lotaria / livrarias ─────────
  { name: 'CTT', domain: 'ctt.pt', type: 'other', aliases: ['correios'] },
  { name: 'Jogos Santa Casa', domain: 'jogossantacasa.pt', type: 'other', aliases: ['santa casa', 'euromilhoes'] },
  { name: 'Bertrand', domain: 'bertrand.pt', type: 'store' },
  { name: 'Wook', domain: 'wook.pt', type: 'store' },
  { name: 'Almedina', domain: 'almedina.net', type: 'store' },

  // ───────── Hotéis / pets / brinquedos ─────────
  { name: 'Pestana', domain: 'pestana.com', type: 'other' },
  { name: 'Vila Galé', domain: 'vilagale.com', type: 'other', aliases: ['vila gale'] },
  { name: 'Marriott', domain: 'marriott.com', type: 'other' },
  { name: 'NH Hotels', domain: 'nh-hotels.com', type: 'other', aliases: ['nh'] },
  { name: 'Kiwoko', domain: 'kiwoko.pt', type: 'store' },
  { name: 'Imaginarium', domain: 'imaginarium.pt', type: 'store' },

  // ───────── Serviços públicos / impostos ─────────
  { name: 'Finanças', domain: 'portaldasfinancas.gov.pt', type: 'other', aliases: ['financas', 'autoridade tributaria', 'impostos', 'at'] },
  { name: 'Segurança Social', domain: 'seg-social.pt', type: 'other', aliases: ['seguranca social'] },
  { name: 'IMT', domain: 'imt-ip.pt', type: 'other' },

  // ───────── Pagamentos / cartões / crédito ─────────
  { name: 'MB WAY', domain: 'mbway.pt', type: 'other', aliases: ['mbway', 'mb way'] },
  { name: 'Wizink', domain: 'wizink.pt', type: 'bank', country: 'pt' },
  { name: 'Cofidis', domain: 'cofidis.pt', type: 'other' },
  { name: 'Cetelem', domain: 'cetelem.pt', type: 'other' },
  { name: 'Unibanco', domain: 'unibanco.pt', type: 'other', aliases: ['unicre'] },

  // ───────── Streaming / TV (extra) ─────────
  { name: 'Paramount+', domain: 'paramountplus.com', type: 'other', aliases: ['paramount'] },
  { name: 'DAZN', domain: 'dazn.com', type: 'other' },
  { name: 'Sport TV', domain: 'sporttv.pt', type: 'other', aliases: ['sport tv'] },

  // ───────── Saúde / suplementos / farmácia ─────────
  { name: 'Prozis', domain: 'prozis.com', type: 'store' },
  { name: 'MyProtein', domain: 'myprotein.pt', type: 'store', aliases: ['my protein'] },
  { name: 'Celeiro', domain: 'celeiro.pt', type: 'store' },
  { name: 'Farmácias Holon', domain: 'holon.pt', type: 'other', aliases: ['holon', 'farmacia holon'] },

  // ───────── Educação ─────────
  { name: 'Universidade do Porto', domain: 'up.pt', type: 'other', aliases: ['u porto', 'universidade porto'] },
  { name: 'Universidade de Lisboa', domain: 'ulisboa.pt', type: 'other', aliases: ['u lisboa'] },
  { name: 'Universidade de Coimbra', domain: 'uc.pt', type: 'other', aliases: ['u coimbra'] },
  { name: 'Universidade NOVA de Lisboa', domain: 'unl.pt', type: 'other', aliases: ['nova', 'nova lisboa'] },
  { name: 'Universidade Católica', domain: 'ucp.pt', type: 'other', aliases: ['catolica'] },
  { name: 'ISCTE', domain: 'iscte-iul.pt', type: 'other' },

  // ───────── Subscrições / serviços digitais ─────────
  { name: 'Discord', domain: 'discord.com', type: 'other' },
  { name: 'Proton', domain: 'proton.me', type: 'other', aliases: ['protonmail', 'proton vpn'] },
  { name: '1Password', domain: '1password.com', type: 'other', aliases: ['1 password'] },
  { name: 'Surfshark', domain: 'surfshark.com', type: 'other' },
  { name: 'ExpressVPN', domain: 'expressvpn.com', type: 'other', aliases: ['express vpn'] },
  { name: 'Patreon', domain: 'patreon.com', type: 'other' },
  { name: 'Substack', domain: 'substack.com', type: 'other' },

  // ───────── Cloud / dev / web ─────────
  { name: 'AWS', domain: 'aws.amazon.com', type: 'other', aliases: ['amazon web services'] },
  { name: 'Google Cloud', domain: 'cloud.google.com', type: 'other', aliases: ['gcp'] },
  { name: 'Microsoft Azure', domain: 'azure.microsoft.com', type: 'other', aliases: ['azure'] },
  { name: 'Cloudflare', domain: 'cloudflare.com', type: 'other' },
  { name: 'Vercel', domain: 'vercel.com', type: 'other' },
  { name: 'Shopify', domain: 'shopify.com', type: 'other' },
  { name: 'Wix', domain: 'wix.com', type: 'other' },
  { name: 'Squarespace', domain: 'squarespace.com', type: 'other' },
  { name: 'WordPress', domain: 'wordpress.com', type: 'other' },
  { name: 'GoDaddy', domain: 'godaddy.com', type: 'other' },

  // ───────── Viagens (extra) ─────────
  { name: 'Trivago', domain: 'trivago.com', type: 'other' },
  { name: 'Kayak', domain: 'kayak.com', type: 'other' },
  { name: 'Hotels.com', domain: 'hotels.com', type: 'other' },
  { name: 'Skyscanner', domain: 'skyscanner.net', type: 'other' },

  // ───────── Retalho / casa (extra) ─────────
  { name: 'Bricomarché', domain: 'bricomarche.pt', type: 'store', aliases: ['bricomarche'] },
  { name: 'JYSK', domain: 'jysk.pt', type: 'store' },
  { name: 'Zara Home', domain: 'zarahome.com', type: 'store', aliases: ['zara home'] },
  { name: 'Note!', domain: 'note.pt', type: 'store', aliases: ['note'] },
  { name: 'Zippy', domain: 'zippyonline.com', type: 'store' },
  { name: 'Toys R Us', domain: 'toysrus.pt', type: 'store', aliases: ['toys r us'] },

  // ───────── Canais de clubes / TV ─────────
  { name: 'Benfica TV', domain: 'benfica.tv', type: 'other', aliases: ['btv', 'benfica tv'] },
  { name: 'Porto Canal', domain: 'portocanal.pt', type: 'other', aliases: ['porto canal'] },
  { name: 'Sporting TV', domain: 'sporting.pt', type: 'other', aliases: ['sporting tv'] },

  // ───────── Suplementos (extra) ─────────
  { name: 'Zumub', domain: 'zumub.com', type: 'store' },
  { name: 'Bulk', domain: 'bulk.com', type: 'store' },
  { name: 'HSN', domain: 'hsnstore.com', type: 'store' },

  // ───────── Universidades / politécnicos ─────────
  { name: 'UTAD', domain: 'utad.pt', type: 'other', aliases: ['tras os montes'] },
  { name: 'Universidade do Minho', domain: 'uminho.pt', type: 'other', aliases: ['u minho', 'minho'] },
  { name: 'Universidade de Aveiro', domain: 'ua.pt', type: 'other', aliases: ['u aveiro', 'aveiro'] },
  { name: 'Universidade da Beira Interior', domain: 'ubi.pt', type: 'other', aliases: ['ubi', 'beira interior'] },
  { name: 'Universidade de Évora', domain: 'uevora.pt', type: 'other', aliases: ['u evora', 'evora'] },
  { name: 'Universidade do Algarve', domain: 'ualg.pt', type: 'other', aliases: ['u algarve', 'algarve'] },
  { name: 'Universidade da Madeira', domain: 'uma.pt', type: 'other', aliases: ['u madeira'] },
  { name: 'Universidade dos Açores', domain: 'uac.pt', type: 'other', aliases: ['u acores', 'acores'] },
  { name: 'Universidade Lusófona', domain: 'ulusofona.pt', type: 'other', aliases: ['lusofona'] },
  { name: 'ISEG', domain: 'iseg.ulisboa.pt', type: 'other' },
  { name: 'Politécnico de Lisboa', domain: 'ipl.pt', type: 'other', aliases: ['ipl'] },
  { name: 'Politécnico do Porto', domain: 'ipp.pt', type: 'other', aliases: ['ipp'] },
  { name: 'Politécnico de Leiria', domain: 'ipleiria.pt', type: 'other', aliases: ['ipleiria'] },
  { name: 'Politécnico de Coimbra', domain: 'ipc.pt', type: 'other', aliases: ['ipc'] },

  // ───────── Aprendizagem / cursos ─────────
  { name: 'Khan Academy', domain: 'khanacademy.org', type: 'other', aliases: ['khan'] },
  { name: 'Babbel', domain: 'babbel.com', type: 'other' },
  { name: 'Busuu', domain: 'busuu.com', type: 'other' },
  { name: 'Skillshare', domain: 'skillshare.com', type: 'other' },

  // ───────── Cosmética / perfumaria (extra) ─────────
  { name: 'Pluricosmética', domain: 'pluricosmetica.pt', type: 'store', aliases: ['pluricosmetica', 'pluri'] },
  { name: 'Notino', domain: 'notino.pt', type: 'store' },
  { name: 'Perfumes & Companhia', domain: 'perfumesecompanhia.pt', type: 'store', aliases: ['perfumes e companhia', 'perfumes companhia'] },
  { name: 'The Body Shop', domain: 'thebodyshop.com', type: 'store', aliases: ['body shop'] },

  // ───────── Moda / calçado (extra) ─────────
  { name: 'Throttleman', domain: 'throttleman.pt', type: 'store' },
  { name: 'Sacoor Brothers', domain: 'sacoorbrothers.com', type: 'store', aliases: ['sacoor'] },
  { name: 'Lanidor', domain: 'lanidor.com', type: 'store' },
  { name: 'MO', domain: 'mo-online.com', type: 'store' },
  { name: 'Seaside', domain: 'seaside.pt', type: 'store' },
  { name: 'Foreva', domain: 'foreva.pt', type: 'store' },
  { name: 'Prénatal', domain: 'prenatal.com', type: 'store', aliases: ['prenatal'] },
  { name: 'Chicco', domain: 'chicco.com', type: 'store' },

  // ───────── Eletrónica / marketplaces (extra) ─────────
  { name: 'Phone House', domain: 'phonehouse.pt', type: 'store', aliases: ['phone house'] },
  { name: 'KuantoKusta', domain: 'kuantokusta.pt', type: 'store', aliases: ['kuanto kusta'] },
  { name: 'Recheio', domain: 'recheio.pt', type: 'store' },

  // ───────── Energia / saúde (extra) ─────────
  { name: 'Plenitude', domain: 'eniplenitude.com', type: 'other', aliases: ['eni'] },
  { name: 'Malo Clinic', domain: 'maloclinics.com', type: 'other', aliases: ['malo'] },

  // ───────── TV / media (PT) ─────────
  { name: 'RTP', domain: 'rtp.pt', type: 'other' },
  { name: 'SIC', domain: 'sic.pt', type: 'other', aliases: ['opto'] },
  { name: 'TVI', domain: 'tvi.pt', type: 'other' },

  // ───────── Ginásios (extra) ─────────
  { name: 'Fitness UP', domain: 'fitnessup.pt', type: 'other', aliases: ['fitness up'] },
  { name: 'GoFit', domain: 'go-fit.pt', type: 'other', aliases: ['go fit', 'go gym'] },
  { name: 'Vivafit', domain: 'vivafit.pt', type: 'other' },
  { name: 'Virgin Active', domain: 'virginactive.pt', type: 'other', aliases: ['virgin active'] },
  { name: 'Kalorias', domain: 'kalorias.pt', type: 'other' },
  { name: 'Anytime Fitness', domain: 'anytimefitness.pt', type: 'other', aliases: ['anytime fitness'] },
  { name: 'Basic-Fit', domain: 'basic-fit.com', type: 'other', aliases: ['basic fit'] },
  { name: 'Body Concept', domain: 'bodyconcept.pt', type: 'other', aliases: ['body concept'] },
  { name: 'Wellhub', domain: 'wellhub.com', type: 'other', aliases: ['gympass'] },
]

export interface Country {
  code: string
  name: string
}

/** Países suportados no seletor de instituições (banco). */
export const COUNTRIES: Country[] = [
  { code: 'pt', name: 'Portugal' },
  { code: 'es', name: 'Espanha' },
  { code: 'fr', name: 'França' },
  { code: 'de', name: 'Alemanha' },
  { code: 'gb', name: 'Reino Unido' },
]

/** Emoji da bandeira gerado a partir do código ISO (sem emojis no ficheiro). */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

/** Logo genérico (placeholder), usado quando nenhuma fonte resolve. */
export const FALLBACK_BRAND_ICON =
  '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 7l3-4h12l3 4"/><path d="M9 11h6"/>'

/** lowercase, sem acentos, espacos colapsados. */
export function normalize(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Todos os termos de match de uma marca (nome + aliases), normalizados. */
function brandTerms(b: Brand): string[] {
  return [b.name, ...(b.aliases ?? [])].map(normalize)
}

/**
 * Resolve uma marca a partir de um nome livre.
 * Match: igualdade -> comeca-por -> palavra inteira. Evita falsos positivos
 * exigindo limite de palavra.
 */
export function findBrand(name?: string | null): Brand | null {
  const n = normalize(name ?? '')
  if (!n) return null

  for (const b of BRANDS) {
    if (brandTerms(b).some((t) => t === n)) return b
  }
  for (const b of BRANDS) {
    if (brandTerms(b).some((t) => t.length >= 3 && (n.startsWith(t + ' ') || n === t))) return b
  }
  for (const b of BRANDS) {
    if (brandTerms(b).some((t) => t.length >= 3 && new RegExp(`(^|\\s)${escapeRegExp(t)}(\\s|$)`).test(n))) return b
  }
  return null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchScore(b: Brand, q: string): number {
  const terms = brandTerms(b)
  let best = 0
  for (const t of terms) {
    if (t === q) best = Math.max(best, 4)
    else if (t.startsWith(q)) best = Math.max(best, 3)
    else if (t.includes(q)) best = Math.max(best, 1)
  }
  return best
}

/** Sugestoes para o autocomplete de entidade (movimentos), ordenadas por relevancia. */
export function searchBrands(query: string, scope: BrandType | 'all' = 'all'): Brand[] {
  const q = normalize(query)
  const pool = scope === 'all' ? BRANDS : BRANDS.filter((b) => b.type === scope)
  if (!q) {
    // Campo focado e vazio: em 'all' (movimentos) mostra lojas/supermercados primeiro.
    if (scope === 'all') {
      const rank = (t: BrandType) => (t === 'store' ? 0 : t === 'other' ? 1 : 2)
      return [...pool].sort((a, b) => rank(a.type) - rank(b.type))
    }
    return pool
  }
  return pool
    .map((b) => ({ b, score: matchScore(b, q) }))
    .filter((x) => x.score > 0)
    .sort((a, c) => c.score - a.score || a.b.name.localeCompare(c.b.name))
    .map((x) => x.b)
}

/**
 * Bancos para o seletor de contas, por país (inclui fintechs globais),
 * filtrados por pesquisa e ordenados (populares primeiro, depois alfabético).
 */
export function accountBanks(country: string, query = ''): Brand[] {
  const q = normalize(query)
  let list = BRANDS.filter(
    (b) => b.type === 'bank' && (b.country === country || b.country === 'global'),
  )
  if (q) list = list.filter((b) => matchScore(b, q) > 0)
  return list.sort(
    (a, b) => Number(!!b.popular) - Number(!!a.popular) || a.name.localeCompare(b.name),
  )
}

export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
}

/** Logo.dev ativo se houver token publishable em VITE_LOGODEV_TOKEN. */
export function logoDevEnabled(): boolean {
  return !!import.meta.env.VITE_LOGODEV_TOKEN
}

/** URL do logo no Logo.dev (`fallback=404` → domínios sem logo dão erro). */
export function logoDevUrl(domain: string): string {
  const token = import.meta.env.VITE_LOGODEV_TOKEN as string | undefined
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${token}&size=128&format=png&fallback=404`
}

/** URL primário do logo: Logo.dev (se houver token) ou favicon do Google. Usado no warm-up. */
export function primaryLogoUrl(domain: string): string {
  return logoDevEnabled() ? logoDevUrl(domain) : faviconUrl(domain)
}

/** Logo de um instrumento por ticker (Logo.dev `/ticker/{SÍMBOLO}`). `fallback=404` quando não existe. */
export function logoDevTickerUrl(ticker: string): string {
  const token = import.meta.env.VITE_LOGODEV_TOKEN as string | undefined
  return `https://img.logo.dev/ticker/${encodeURIComponent(ticker.toUpperCase())}?token=${token}&size=128&format=png&fallback=404`
}

/** Dominios dos bancos globais/PT principais -- usados para warm-up de cache. */
export const POPULAR_BANK_DOMAINS: string[] = BRANDS.filter((b) => b.type === 'bank' && b.popular)
  .slice(0, 12)
  .map((b) => b.domain)
