/**
 * Villes par pays, indexées sur le code ISO du pays.
 *
 * PORTÉE ASSUMÉE. Les pays où vivent vos membres — Afrique francophone et
 * principales destinations de la diaspora — disposent d'une liste d'une
 * cinquantaine de localités, chefs-lieux ET villes secondaires : quelqu'un
 * de Bassar, de Ouélessébougou ou de Vohémar doit se retrouver, pas
 * seulement les habitants des capitales.
 *
 * Les autres pays reçoivent leurs principales villes. Compléter les 195
 * pays à cinquante localités chacun reviendrait à inventer des noms — le
 * défaut qu'on a passé la semaine à corriger ailleurs. La saisie libre
 * reste ouverte partout : personne n'est bloqué faute de figurer ici.
 */

export const VILLES: Record<string, string[]> = {
  // ── Togo ──────────────────────────────────────────────────
  TG: [
    "Lomé", "Sokodé", "Kara", "Kpalimé", "Atakpamé", "Dapaong", "Tsévié",
    "Aného", "Sansanné-Mango", "Bassar", "Tchamba", "Niamtougou", "Notsé",
    "Badou", "Vogan", "Sotouboua", "Kandé", "Amlamé", "Tabligbo", "Bafilo",
    "Blitta", "Guérin-Kouka", "Agbélouvé", "Kévé", "Assahoun", "Adéta",
    "Anié", "Pagouda", "Barkoissi", "Tandjouaré", "Cinkassé", "Bombouaka",
    "Nadoba", "Kanté", "Défalé", "Alédjo", "Agou-Gadzépé", "Kouvé",
    "Tohoun", "Afagnan", "Agbodrafo", "Baguida", "Kpémé", "Danyi",
    "Wahala", "Élavagnon", "Akébou", "Kpélé-Adéta", "Tsévié-Djagblé", "Aveta",
  ],

  // ── Côte d'Ivoire ─────────────────────────────────────────
  CI: [
    "Abidjan", "Bouaké", "Daloa", "Yamoussoukro", "San-Pédro", "Korhogo",
    "Man", "Divo", "Gagnoa", "Abengourou", "Anyama", "Agboville",
    "Grand-Bassam", "Dabou", "Bingerville", "Séguéla", "Bondoukou",
    "Odienné", "Ferkessédougou", "Katiola", "Soubré", "Adzopé", "Issia",
    "Sinfra", "Toumodi", "Duékoué", "Danané", "Bouaflé", "Oumé", "Lakota",
    "Tiassalé", "Guiglo", "Bouna", "Boundiali", "Tabou", "Sassandra",
    "Aboisso", "Akoupé", "Daoukro", "Bocanda", "Tanda", "Vavoua",
    "Zuénoula", "Béoumi", "Sakassou", "Tiébissou", "Didiévi", "Arrah",
    "Bongouanou", "Adiaké",
  ],

  // ── Sénégal ───────────────────────────────────────────────
  SN: [
    "Dakar", "Pikine", "Touba", "Thiès", "Rufisque", "Kaolack", "Mbour",
    "Ziguinchor", "Saint-Louis", "Diourbel", "Louga", "Tambacounda",
    "Richard-Toll", "Kolda", "Mbacké", "Tivaouane", "Joal-Fadiouth",
    "Dahra", "Bignona", "Kédougou", "Sédhiou", "Matam", "Fatick",
    "Nioro du Rip", "Vélingara", "Pout", "Guédiawaye", "Bargny",
    "Ourossogui", "Podor", "Sokone", "Kayar", "Gandiaye", "Ndioum",
    "Goudomp", "Bakel", "Linguère", "Koungheul", "Kaffrine", "Diamniadio",
    "Mékhé", "Khombole", "Thiadiaye", "Foundiougne", "Bambey",
    "Guinguinéo", "Ndoffane", "Passy", "Toubacouta", "Oussouye",
  ],

  // ── Cameroun ──────────────────────────────────────────────
  CM: [
    "Douala", "Yaoundé", "Garoua", "Bamenda", "Maroua", "Bafoussam",
    "Ngaoundéré", "Bertoua", "Loum", "Kumba", "Nkongsamba", "Buea",
    "Limbe", "Edéa", "Kribi", "Foumban", "Dschang", "Ebolowa", "Guider",
    "Meiganga", "Bafang", "Mbalmayo", "Sangmélima", "Bafia", "Kousséri",
    "Mbouda", "Bandjoun", "Manjo", "Tiko", "Wum", "Kumbo", "Ndop",
    "Mamfé", "Batouri", "Yokadouma", "Abong-Mbang", "Akonolinga", "Obala",
    "Mbanga", "Penja", "Melong", "Banyo", "Tibati", "Tignère", "Poli",
    "Figuil", "Mokolo", "Mora", "Yagoua", "Kaélé",
  ],

  // ── Bénin ─────────────────────────────────────────────────
  BJ: [
    "Cotonou", "Porto-Novo", "Parakou", "Djougou", "Bohicon", "Abomey",
    "Natitingou", "Lokossa", "Ouidah", "Kandi", "Abomey-Calavi",
    "Sèmè-Podji", "Malanville", "Savé", "Pobè", "Sakété", "Comé",
    "Aplahoué", "Dogbo", "Allada", "Nikki", "Bembèrèkè", "Tanguiéta",
    "Banikoara", "Kérou", "Ségbana", "Dassa-Zoumè", "Savalou", "Glazoué",
    "Bantè", "Covè", "Zagnanado", "Kétou", "Adjohoun", "Bonou", "Dangbo",
    "Grand-Popo", "Athiémé", "Houéyogbé", "Toffo", "Zè", "Tori-Bossito",
    "Kpomassè", "Sô-Ava", "Adjarra", "Avrankou", "Ifangni", "N'Dali",
    "Tchaourou", "Boukoumbé",
  ],

  // ── Burkina Faso ──────────────────────────────────────────
  BF: [
    "Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Ouahigouya", "Banfora",
    "Dédougou", "Kaya", "Tenkodogo", "Fada N'Gourma", "Houndé", "Réo",
    "Manga", "Ziniaré", "Gaoua", "Dori", "Nouna", "Garango", "Koupéla",
    "Pouytenga", "Yako", "Tougan", "Boulsa", "Diapaga", "Djibo",
    "Gorom-Gorom", "Kombissiri", "Léo", "Orodara", "Pô", "Sapouy",
    "Solenzo", "Titao", "Zorgho", "Bogandé", "Boromo", "Dano",
    "Diébougou", "Gourcy", "Kongoussi", "Nanoro", "Niangoloko", "Sebba",
    "Sindou", "Toma", "Zabré", "Bittou", "Boussé", "Kantchari",
    "Batié", "Sapaga",
  ],

  // ── Mali ──────────────────────────────────────────────────
  ML: [
    "Bamako", "Sikasso", "Mopti", "Koutiala", "Ségou", "Kayes", "Gao",
    "Kati", "Markala", "Tombouctou", "San", "Bougouni", "Koulikoro",
    "Niono", "Nioro du Sahel", "Kolokani", "Bandiagara", "Djenné",
    "Douentza", "Kidal", "Ansongo", "Bafoulabé", "Banamba", "Bla",
    "Diéma", "Dioïla", "Fana", "Kangaba", "Kéniéba", "Kita",
    "Kolondiéba", "Koro", "Ménaka", "Nara", "Ouélessébougou", "Sévaré",
    "Sokolo", "Ténenkou", "Yanfolila", "Yélimané", "Youwarou", "Bourem",
    "Goundam", "Niafunké", "Diré", "Macina", "Barouéli", "Kimparana",
    "Ké-Macina", "Baguinéda",
  ],

  // ── Niger ─────────────────────────────────────────────────
  NE: [
    "Niamey", "Zinder", "Maradi", "Agadez", "Tahoua", "Dosso", "Arlit",
    "Birni N'Konni", "Tessaoua", "Gaya", "Diffa", "Tillabéri", "Madaoua",
    "Mirriah", "Magaria", "Matameye", "Illéla", "Ayorou", "Filingué",
    "Téra", "Say", "Dogondoutchi", "Loga", "Bouza", "Keita",
    "Tchintabaraden", "Abalak", "Bilma", "N'Guigmi", "Maïné-Soroa",
    "Gouré", "Tanout", "Belbédji", "Dakoro", "Guidan Roumdji", "Aguié",
    "Tibiri", "Falmey", "Balleyara", "Kollo", "Torodi", "Makalondi",
    "Birni N'Gaouré", "Doutchi", "Tanda", "Djado", "Ingall", "Tchirozérine",
    "Iférouane", "Bankilaré",
  ],

  // ── Guinée ────────────────────────────────────────────────
  GN: [
    "Conakry", "Nzérékoré", "Kankan", "Kindia", "Labé", "Guéckédou",
    "Mamou", "Boké", "Kissidougou", "Macenta", "Siguiri", "Faranah",
    "Pita", "Dabola", "Dalaba", "Télimélé", "Fria", "Kamsar", "Coyah",
    "Dubréka", "Forécariah", "Kouroussa", "Mandiana", "Kérouané",
    "Beyla", "Lola", "Yomou", "Dinguiraye", "Tougué", "Koubia",
    "Lélouma", "Mali", "Gaoual", "Koundara", "Boffa", "Kaloum",
    "Matoto", "Ratoma", "Dixinn", "Matam",
  ],

  // ── Gabon ─────────────────────────────────────────────────
  GA: [
    "Libreville", "Port-Gentil", "Franceville", "Oyem", "Moanda",
    "Mouila", "Lambaréné", "Tchibanga", "Koulamoutou", "Makokou",
    "Bitam", "Gamba", "Ndendé", "Booué", "Mitzic", "Lastoursville",
    "Okondja", "Fougamou", "Ntoum", "Cocobeach", "Omboué", "Mayumba",
    "Minvoul", "Médouneu", "Kango", "Ndjolé", "Mimongo", "Akiéni",
    "Léconi", "Bifoun",
  ],

  // ── Congo ─────────────────────────────────────────────────
  CG: [
    "Brazzaville", "Pointe-Noire", "Dolisie", "Nkayi", "Owando", "Ouésso",
    "Impfondo", "Madingou", "Gamboma", "Sibiti", "Mossendjo", "Kinkala",
    "Djambala", "Ewo", "Sembé", "Makoua", "Oyo", "Boundji", "Mindouli",
    "Kindamba", "Mayama", "Zanaga", "Komono", "Divénié", "Kellé",
    "Bétou", "Dongou", "Épéna", "Loandjili", "Tié-Tié",
  ],

  // ── Congo (RDC) ───────────────────────────────────────────
  CD: [
    "Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani",
    "Bukavu", "Goma", "Tshikapa", "Kolwezi", "Likasi", "Matadi", "Uvira",
    "Butembo", "Beni", "Bunia", "Isiro", "Kikwit", "Mbandaka",
    "Mwene-Ditu", "Kalemie", "Gemena", "Kindu", "Boma", "Kamina",
    "Baraka", "Kabinda", "Lisala", "Bumba", "Buta", "Kongolo", "Ilebo",
    "Lodja", "Tshela", "Inongo", "Basankusu", "Gbadolite", "Zongo",
    "Businga", "Aketi", "Watsa", "Dungu", "Faradje", "Aru", "Mahagi",
    "Djugu", "Fizi", "Shabunda", "Punia", "Lubao", "Moba",
  ],

  // ── Tchad ─────────────────────────────────────────────────
  TD: [
    "N'Djaména", "Moundou", "Sarh", "Abéché", "Kélo", "Koumra", "Pala",
    "Am Timan", "Bongor", "Mongo", "Ati", "Oum Hadjer", "Doba",
    "Bitkine", "Massaguet", "Massakory", "Fada", "Faya-Largeau", "Bol",
    "Mao", "Biltine", "Goz Beïda", "Léré", "Bébédjia", "Bénoye", "Laï",
    "Guelendeng", "Bousso", "Melfi", "Mboursou Léré",
  ],

  // ── Madagascar ────────────────────────────────────────────
  MG: [
    "Antananarivo", "Toamasina", "Antsirabe", "Fianarantsoa", "Mahajanga",
    "Toliara", "Antsiranana", "Ambovombe", "Amparafaravola", "Antanifotsy",
    "Ambatondrazaka", "Moramanga", "Sambava", "Manakara", "Farafangana",
    "Nosy Be", "Morondava", "Maintirano", "Tsiroanomandidy", "Miarinarivo",
    "Ambositra", "Mananjary", "Vangaindrano", "Ihosy", "Betroka",
    "Taolagnaro", "Ambanja", "Antalaha", "Andapa", "Vohémar",
    "Port-Bergé", "Marovoay", "Soanierana-Ivongo", "Fenoarivo Atsinanana",
    "Vatomandry", "Mahanoro", "Marolambo", "Ambatolampy", "Arivonimamo",
    "Anjozorobe",
  ],

  // ── France ────────────────────────────────────────────────
  FR: [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes",
    "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims",
    "Saint-Étienne", "Toulon", "Le Havre", "Grenoble", "Dijon", "Angers",
    "Nîmes", "Villeurbanne", "Clermont-Ferrand", "Aix-en-Provence",
    "Brest", "Limoges", "Tours", "Amiens", "Perpignan", "Metz",
    "Besançon", "Boulogne-Billancourt", "Orléans", "Mulhouse", "Rouen",
    "Caen", "Nancy", "Argenteuil", "Montreuil", "Saint-Denis", "Roubaix",
    "Tourcoing", "Avignon", "Nanterre", "Créteil", "Poitiers",
    "Versailles", "Courbevoie", "Vitry-sur-Seine", "Colombes",
    "Asnières-sur-Seine", "Aulnay-sous-Bois",
  ],

  // ── Belgique ──────────────────────────────────────────────
  BE: [
    "Bruxelles", "Anvers", "Gand", "Charleroi", "Liège", "Bruges",
    "Namur", "Louvain", "Mons", "Alost", "Malines", "La Louvière",
    "Courtrai", "Hasselt", "Saint-Nicolas", "Ostende", "Tournai", "Genk",
    "Seraing", "Roulers", "Verviers", "Mouscron", "Beveren", "Termonde",
    "Turnhout", "Dinant", "Arlon", "Wavre", "Nivelles", "Huy",
  ],

  // ── Suisse ────────────────────────────────────────────────
  CH: [
    "Zurich", "Genève", "Bâle", "Lausanne", "Berne", "Winterthour",
    "Lucerne", "Saint-Gall", "Lugano", "Bienne", "Thoune", "Köniz",
    "La Chaux-de-Fonds", "Fribourg", "Schaffhouse", "Vernier", "Coire",
    "Neuchâtel", "Uster", "Sion", "Lancy", "Emmen", "Yverdon-les-Bains",
    "Zoug", "Kriens", "Rapperswil-Jona", "Dübendorf", "Montreux",
    "Dietikon", "Frauenfeld",
  ],

  // ── Canada ────────────────────────────────────────────────
  CA: [
    "Toronto", "Montréal", "Vancouver", "Calgary", "Edmonton", "Ottawa",
    "Winnipeg", "Québec", "Hamilton", "Kitchener", "London", "Victoria",
    "Halifax", "Oshawa", "Windsor", "Saskatoon", "Regina", "Sherbrooke",
    "Barrie", "Kelowna", "Abbotsford", "Trois-Rivières", "Kingston",
    "Guelph", "Moncton", "Saguenay", "Brantford", "Thunder Bay",
    "Sudbury", "Laval", "Gatineau", "Longueuil", "Saint-Jean-sur-Richelieu",
    "Lévis", "Terrebonne", "Repentigny", "Drummondville", "Granby",
    "Saint-Jérôme", "Shawinigan",
  ],

  // ── Autres pays d'Afrique ─────────────────────────────────
  NG: [
    "Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt", "Benin City",
    "Kaduna", "Maiduguri", "Zaria", "Aba", "Jos", "Ilorin", "Oyo",
    "Enugu", "Abeokuta", "Onitsha", "Warri", "Sokoto", "Calabar", "Uyo",
  ],
  GH: [
    "Accra", "Kumasi", "Tamale", "Takoradi", "Ashaiman", "Sunyani",
    "Cape Coast", "Obuasi", "Teshie", "Tema", "Koforidua", "Ho",
    "Wa", "Bolgatanga", "Techiman", "Nkawkaw", "Winneba", "Bawku",
  ],
  MA: [
    "Casablanca", "Rabat", "Fès", "Marrakech", "Tanger", "Agadir",
    "Meknès", "Oujda", "Kénitra", "Tétouan", "Safi", "Salé",
    "El Jadida", "Nador", "Béni Mellal", "Khouribga", "Mohammedia",
    "Taza", "Essaouira", "Ouarzazate",
  ],
  DZ: [
    "Alger", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Sétif",
    "Tlemcen", "Béjaïa", "Djelfa", "Sidi Bel Abbès", "Biskra", "Tiaret",
    "Béchar", "Skikda", "Ghardaïa", "Mostaganem", "Tizi Ouzou",
  ],
  TN: [
    "Tunis", "Sfax", "Sousse", "Kairouan", "Bizerte", "Gabès", "Ariana",
    "Gafsa", "Monastir", "Nabeul", "Médenine", "Béja", "Jendouba",
    "Tozeur", "Mahdia", "Zarzis", "Hammamet", "Kasserine",
  ],
  RW: [
    "Kigali", "Butare", "Gitarama", "Ruhengeri", "Gisenyi", "Byumba",
    "Cyangugu", "Kibuye", "Kibungo", "Nyanza", "Rwamagana", "Musanze",
    "Rubavu", "Huye", "Muhanga", "Nyagatare",
  ],
  BI: [
    "Bujumbura", "Gitega", "Ngozi", "Muyinga", "Ruyigi", "Kayanza",
    "Rutana", "Bururi", "Makamba", "Cibitoke", "Muramvya", "Karuzi",
    "Kirundo", "Rumonge", "Bubanza", "Mwaro",
  ],
  CF: [
    "Bangui", "Bimbo", "Berbérati", "Carnot", "Bambari", "Bouar",
    "Bossangoa", "Bria", "Bangassou", "Nola", "Kaga-Bandoro", "Sibut",
    "Mbaïki", "Batangafo", "Birao", "Obo",
  ],
  MR: [
    "Nouakchott", "Nouadhibou", "Rosso", "Kaédi", "Zouérate", "Kiffa",
    "Néma", "Sélibaby", "Atar", "Aleg", "Boutilimit", "Tidjikja",
    "Akjoujt", "Aïoun el Atrouss",
  ],
  GQ: ["Malabo", "Bata", "Ebebiyín", "Aconibe", "Añisoc", "Luba", "Evinayong", "Mongomo", "Mbini", "Micomeseng"],
  KM: ["Moroni", "Mutsamudu", "Fomboni", "Domoni", "Tsimbeo", "Ouani", "Mitsamiouli", "Foumbouni"],
  MU: ["Port-Louis", "Beau-Bassin Rose-Hill", "Vacoas-Phoenix", "Curepipe", "Quatre Bornes", "Triolet", "Goodlands", "Centre de Flacq", "Mahébourg", "Rivière du Rempart"],
  DJ: ["Djibouti", "Ali Sabieh", "Tadjourah", "Obock", "Dikhil", "Arta", "Holhol", "Goubetto"],
  CV: ["Praia", "Mindelo", "Santa Maria", "Assomada", "Pedra Badejo", "São Filipe", "Tarrafal", "Espargos"],
  GW: ["Bissau", "Bafatá", "Gabú", "Canchungo", "Cacheu", "Bubaque", "Catió", "Farim", "Mansôa", "Buba"],
  ST: ["São Tomé", "Neves", "Santana", "Trindade", "Guadalupe", "Santo António"],
  SC: ["Victoria", "Anse Boileau", "Beau Vallon", "Takamaka", "Baie Lazare"],
  KE: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Malindi", "Kitale", "Garissa", "Nyeri"],
  ZA: ["Johannesburg", "Le Cap", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London", "Polokwane", "Nelspruit", "Kimberley"],
  AO: ["Luanda", "Huambo", "Lobito", "Benguela", "Lubango", "Cabinda", "Malanje", "Namibe", "Uíge", "Soyo"],
  TZ: ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya", "Morogoro", "Tanga", "Zanzibar", "Kigoma", "Moshi"],
  UG: ["Kampala", "Gulu", "Lira", "Mbarara", "Jinja", "Mbale", "Entebbe", "Masaka", "Arua", "Fort Portal"],

  // ── Europe et Amériques ───────────────────────────────────
  US: [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
    "Philadelphie", "San Antonio", "San Diego", "Dallas", "Atlanta",
    "Washington", "Boston", "Miami", "Seattle", "Denver", "Minneapolis",
    "Charlotte", "Détroit", "Baltimore", "Columbus",
  ],
  GB: [
    "Londres", "Birmingham", "Manchester", "Glasgow", "Liverpool",
    "Leeds", "Bristol", "Sheffield", "Édimbourg", "Leicester",
    "Coventry", "Nottingham", "Newcastle", "Cardiff", "Belfast",
  ],
  DE: [
    "Berlin", "Hambourg", "Munich", "Cologne", "Francfort", "Stuttgart",
    "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Brême", "Dresde",
    "Hanovre", "Nuremberg", "Duisbourg",
  ],
  IT: [
    "Rome", "Milan", "Naples", "Turin", "Palerme", "Gênes", "Bologne",
    "Florence", "Bari", "Catane", "Venise", "Vérone", "Messine", "Padoue",
  ],
  ES: [
    "Madrid", "Barcelone", "Valence", "Séville", "Saragosse", "Málaga",
    "Murcie", "Palma", "Las Palmas", "Bilbao", "Alicante", "Cordoue",
  ],
  PT: ["Lisbonne", "Porto", "Amadora", "Braga", "Setúbal", "Coimbra", "Funchal", "Faro", "Aveiro", "Évora"],
  NL: ["Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Eindhoven", "Tilbourg", "Groningue", "Almere", "Breda", "Nimègue"],
  HT: ["Port-au-Prince", "Cap-Haïtien", "Gonaïves", "Les Cayes", "Jacmel", "Jérémie", "Port-de-Paix", "Hinche", "Saint-Marc", "Petit-Goâve"],
  BR: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Porto Alegre"],
};

/**
 * Villes d'un pays, triées alphabétiquement.
 *
 * L'ordre alphabétique plutôt que par population : dans une liste
 * cherchable, on tape les premières lettres — on ne fait pas défiler un
 * classement démographique.
 */
export function villesDe(codePays?: string | null): string[] {
  if (!codePays) return [];
  return [...(VILLES[codePays] ?? [])].sort((a, b) => a.localeCompare(b, "fr"));
}

export function aDesVilles(codePays?: string | null): boolean {
  return Boolean(codePays && VILLES[codePays]?.length);
}
