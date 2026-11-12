/**
 * Pages par pays.
 *
 * ATTENTION — chaque pays doit avoir un contenu RÉELLEMENT distinct.
 * Dupliquer un même texte en changeant seulement le nom du pays produit du
 * contenu dupliqué : Google n'en garde alors qu'une seule et ignore les
 * autres, ce qui annule tout l'intérêt de la démarche.
 *
 * D'où les champs `intro`, `paysage` et `conseil`, rédigés séparément et
 * ancrés dans des réalités propres à chaque pays.
 *
 * Règle rédactionnelle : aucun chiffre de fréquentation inventé. Annoncer
 * « 4 000 membres au Togo » sans le savoir se retournerait contre nous —
 * un utilisateur déçu ne revient pas, et Google finit par sanctionner les
 * pages qui promettent ce qu'elles ne tiennent pas.
 */

export type Country = {
  slug: string;
  name: string;
  demonym: string;
  flag: string;
  /** Titre de la page — porte la requête visée */
  title: string;
  metaDescription: string;
  /** Accroche affichée sous le titre */
  intro: string;
  /** Villes réellement significatives du pays */
  cities: string[];
  /** Paysage confessionnel — c'est ce qui différencie vraiment les pages */
  paysage: string;
  /** Conseil concret, adapté au contexte local */
  conseil: string;
  /** Questions locales fréquentes */
  faq: { q: string; a: string }[];
  /**
   * Développements propres au pays, affichés après le conseil. Facultatif :
   * une page pays courte et presque identique aux autres est traitée par
   * Google comme une page satellite. Ces sections lui donnent un vrai fond.
   */
  sections?: { heading: string; body: string[] }[];
};

export const COUNTRIES: Country[] = [
  {
    slug: "togo",
    name: "Togo",
    demonym: "togolaise",
    flag: "🇹🇬",
    title: "Rencontre chrétienne au Togo — trouvez votre conjoint en Christ",
    metaDescription:
      "Rencontres chrétiennes sérieuses au Togo et dans la diaspora : des célibataires de Lomé, Kara, Sokodé et d'ailleurs qui cherchent un mariage fondé sur la foi.",
    intro:
      "Au Togo, la foi se vit au quotidien — dans les assemblées du dimanche comme dans les cellules de prière en semaine. Eden Rencontre réunit des célibataires togolais qui ne cherchent pas une aventure, mais une alliance.",
    cities: ["Lomé", "Sokodé", "Kara", "Kpalimé", "Atakpamé", "Dapaong", "Tsévié", "Aného"],
    paysage:
      "Le paysage chrétien togolais est marqué par une forte présence évangélique et pentecôtiste, aux côtés d'une Église catholique bien implantée et des Églises méthodistes et presbytériennes historiques du sud du pays. Cette diversité fait que la question de la confession se pose très concrètement au moment du mariage : deux familles peuvent porter une même foi et des pratiques très différentes.",
    conseil:
      "À Lomé, beaucoup de rencontres passent encore par l'assemblée ou la famille élargie. C'est précieux, mais cela limite le cercle à quelques dizaines de personnes. Élargir sa recherche au-delà de sa paroisse ne signifie pas renoncer à ses convictions : cela signifie rencontrer davantage de personnes qui les partagent déjà.",
    faq: [
      {
        q: "Puis-je préciser ma confession dans mes critères de recherche ?",
        a: "Oui. Vous pouvez filtrer sur la confession et sur le niveau de pratique, afin de rencontrer des personnes dont la foi s'exprime comme la vôtre. Cette recherche affinée fait partie de la formule Premium.",
      },
      {
        q: "Puis-je rencontrer des Togolais vivant à l'étranger ?",
        a: "Oui. De nombreux membres de la diaspora togolaise en France, au Canada ou en Allemagne recherchent un conjoint partageant leur culture et leur foi. Aucun filtre ne vous enferme dans un seul pays.",
      },
    ],
    sections: [
      {
        heading: "Pourquoi tant de Togolais cherchent en ligne",
        body: [
          "À Lomé, entre les embouteillages et les journées qui finissent tard, il reste peu de temps pour rencontrer du monde en dehors du travail et de l'église. À Kara, Sokodé, Atakpamé ou Kpalimé, c'est souvent l'inverse : on a le temps, mais le choix est réduit et tout le monde se connaît.",
          "Il y a aussi tous ceux qui sont partis : étudiants en France ou en Belgique, travailleurs en Allemagne, au Ghana, en Côte d'Ivoire. Beaucoup veulent épouser quelqu'un qui connaît le pays et ses usages, sans savoir par où commencer. Eden Rencontre réunit des chrétiens de nombreux pays : un Togolais de Lomé peut y croiser une Togolaise de Montréal comme une Béninoise de Cotonou.",
        ],
      },
      {
        heading: "Les sujets à aborder tôt",
        body: [
          "La foi commune ne fait pas un couple à elle seule. Elle donne une base. L'Église, d'abord : catholique, Assemblées de Dieu, méthodiste, évangélique, pentecôtiste… Ce n'est pas un mur, mais ça pèse sur la cérémonie, sur l'éducation des enfants et sur le dimanche matin pendant quarante ans.",
          "La famille, ensuite. Au Togo, on n'épouse pas seulement une personne. Parler tôt de la présentation aux parents évite bien des surprises. La dot, aussi : chez les Éwé, les Kabyè, les Mina, les Tem ou les Moba, les usages ne se ressemblent pas, et mieux vaut savoir ce qu'attend chaque famille avant les fiançailles.",
          "Et la question du lieu de vie : Lomé, l'intérieur du pays, l'étranger ? Elle mérite d'être posée avant de s'attacher.",
        ],
      },
      {
        heading: "Se rencontrer en confiance",
        body: [
          "La grande majorité des membres sont sincères. Quelques règles protègent des autres. Le premier rendez-vous se fait dans un lieu public et fréquenté, de préférence en journée, et un proche sait où vous êtes.",
          "On n'envoie jamais d'argent à quelqu'un qu'on n'a pas rencontré, quelle que soit l'histoire : un accident, des frais de douane, un billet d'avion bloqué. Et une personne qui refuse tout appel vidéo, ou qui veut quitter la plateforme dès le deuxième message, mérite de la méfiance.",
        ],
      },
    ],
  },
  {
    slug: "benin",
    name: "Bénin",
    demonym: "béninoise",
    flag: "🇧🇯",
    title: "Rencontre chrétienne au Bénin — célibataires en quête de mariage",
    metaDescription:
      "Site de rencontre chrétien au Bénin et dans la diaspora : des célibataires de Cotonou, Porto-Novo, Parakou et d'ailleurs, décidés à bâtir un foyer chrétien.",
    intro:
      "Au Bénin, se dire chrétien engage souvent face à toute une famille. Eden Rencontre s'adresse à celles et ceux qui veulent que ce choix soit aussi celui de leur couple.",
    cities: ["Cotonou", "Porto-Novo", "Parakou", "Abomey", "Bohicon", "Natitingou", "Djougou", "Ouidah"],
    paysage:
      "Le Bénin présente une mosaïque religieuse singulière : christianisme, islam et religions traditionnelles y coexistent étroitement, parfois au sein d'une même famille. Pour un célibataire chrétien, la question du conjoint devient alors moins celle de la dénomination que celle d'un socle commun clairement assumé, souvent discuté avec les aînés avant tout engagement.",
    conseil:
      "Dans ce contexte, il vaut mieux nommer ses convictions tôt plutôt que tard. Une relation qui avance en évitant le sujet de la foi finit presque toujours par y buter — généralement au moment où les familles se rencontrent, c'est-à-dire au pire moment.",
    faq: [
      {
        q: "Comment aborder la question de la foi dès les premiers échanges ?",
        a: "Votre profil peut le faire pour vous. En renseignant votre confession, votre pratique et votre vision du mariage, vous filtrez naturellement : les personnes qui vous écrivent savent déjà où vous en êtes.",
      },
      {
        q: "L'application fonctionne-t-elle avec une connexion limitée ?",
        a: "Oui. Les pages sont allégées et les images chargées à la demande, pour rester utilisable sur une connexion mobile modeste.",
      },
    ],
    sections: [
      {
        heading: "Cotonou, Porto-Novo, Parakou… et bien au-delà",
        body: [
          "Cotonou concentre une bonne part des jeunes actifs du pays, mais une vie professionnelle chargée laisse peu de place aux rencontres. À Porto-Novo, Abomey-Calavi, Parakou ou Bohicon, beaucoup de célibataires chrétiens connaissent la même difficulté : un cercle d'église où l'on se connaît depuis l'enfance, et peu d'occasions d'en sortir.",
          "Eden Rencontre élargit ce cercle sans changer de valeurs. Un célibataire de Cotonou peut y échanger avec quelqu'un de Parakou, mais aussi avec des Béninois de la diaspora, à Paris, à Bruxelles ou à Montréal, et avec des chrétiens d'autres pays francophones.",
        ],
      },
      {
        heading: "Une même foi, des Églises très différentes",
        body: [
          "Le christianisme béninois est d'une grande diversité. L'Église catholique est solidement implantée, aux côtés de l'Église protestante méthodiste, des Assemblées de Dieu, des nombreuses Églises évangéliques et pentecôtistes, et du Christianisme céleste, né à Porto-Novo et très présent dans le sud du pays.",
          "Ces Églises n'ont ni la même liturgie, ni les mêmes interdits, ni la même façon de célébrer un mariage. Deux personnes qui se disent chrétiennes peuvent donc avoir des attentes très éloignées. Mieux vaut en parler dès les premiers échanges, avec simplicité, plutôt que de le découvrir au moment de la bénédiction nuptiale.",
        ],
      },
      {
        heading: "La famille, la dot et la tradition",
        body: [
          "Au Bénin, le mariage engage deux familles, souvent bien avant l'église ou la mairie. Les usages de la dot diffèrent d'une région à l'autre, chez les Fon, les Goun, les Yoruba, les Bariba ou les Adja, et ce qu'une famille juge normal peut surprendre l'autre.",
          "Il arrive aussi que la foi d'une famille soit plus mélangée qu'on ne le pense, entre christianisme et religions traditionnelles. Pour un couple chrétien, ce n'est pas une raison de rompre, mais c'est un sujet à aborder avec respect et clarté avant les fiançailles : où se fera la cérémonie, quelles pratiques le couple accepte ou non.",
        ],
      },
      {
        heading: "Se rencontrer en confiance",
        body: [
          "Prenez le temps d'échanger par messages, puis par appel, avant toute rencontre. Le premier rendez-vous se fait dans un lieu public, et un proche sait où vous êtes.",
          "N'envoyez jamais d'argent à quelqu'un que vous n'avez pas rencontré, quelle que soit la raison invoquée. Et signalez à notre équipe tout profil qui vous paraît suspect : c'est ce qui permet de garder la communauté sûre pour tous.",
        ],
      },
    ],
  },
  {
    slug: "cote-divoire",
    name: "Côte d'Ivoire",
    demonym: "ivoirienne",
    flag: "🇨🇮",
    title: "Rencontre chrétienne en Côte d'Ivoire — Abidjan, Bouaké, Yamoussoukro",
    metaDescription:
      "Rencontres chrétiennes sérieuses en Côte d'Ivoire. Célibataires chrétiens d'Abidjan, Bouaké et Yamoussoukro tournés vers le mariage.",
    intro:
      "Abidjan concentre une vie chrétienne intense — grandes assemblées, groupes de jeunes, veillées. Et pourtant, y trouver un conjoint qui partage réellement sa foi reste difficile. Eden Rencontre existe pour ça.",
    cities: ["Abidjan", "Bouaké", "Yamoussoukro", "Daloa", "San-Pédro", "Korhogo", "Man", "Gagnoa"],
    paysage:
      "La Côte d'Ivoire abrite certaines des plus grandes assemblées évangéliques d'Afrique de l'Ouest, aux côtés d'une Église catholique très structurée et d'un réseau dense d'Églises de réveil. Le paradoxe est connu : dans une assemblée de plusieurs milliers de personnes, beaucoup de célibataires ne rencontrent personne, faute d'un cadre qui permette de se parler autrement qu'en groupe.",
    conseil:
      "La taille d'une assemblée ne fait pas la facilité des rencontres — elle la complique parfois. Un profil qui dit précisément ce que vous cherchez vaut mieux que des mois de présence discrète au fond de la salle.",
    faq: [
      {
        q: "Comment distinguer un profil sérieux d'un profil douteux ?",
        a: "Regardez le badge de vérification, la présence d'une bio réellement écrite et la cohérence entre les photos. Vous pouvez signaler ou bloquer un membre en deux clics, et nos équipes traitent chaque signalement.",
      },
      {
        q: "Puis-je échanger avant de me décider à rencontrer quelqu'un ?",
        a: "Oui, et c'est recommandé. Messagerie, messages vocaux et appels audio ou vidéo permettent de se connaître à distance avant toute rencontre physique.",
      },
    ],
  },
  {
    slug: "senegal",
    name: "Sénégal",
    demonym: "sénégalaise",
    flag: "🇸🇳",
    title: "Rencontre chrétienne au Sénégal — Dakar, Thiès, Ziguinchor",
    metaDescription:
      "Rencontres chrétiennes au Sénégal. Rejoignez une communauté de célibataires chrétiens à Dakar, Thiès et en Casamance.",
    intro:
      "Être chrétien au Sénégal, c'est appartenir à une minorité soudée. Trouver un conjoint qui partage cette foi demande souvent de sortir de son cercle immédiat.",
    cities: ["Dakar", "Thiès", "Ziguinchor", "Saint-Louis", "Kaolack", "Mbour", "Rufisque"],
    paysage:
      "Les chrétiens représentent une part réduite de la population sénégalaise, avec une présence catholique historiquement forte, notamment en Casamance et dans la région de Dakar. Cette situation minoritaire crée une communauté très liée — mais aussi un vivier restreint, où beaucoup de célibataires se connaissent déjà depuis l'enfance.",
    conseil:
      "C'est précisément dans ce cas qu'une plateforme prend tout son sens : elle relie Dakar à Ziguinchor, et le Sénégal à sa diaspora, là où le cercle paroissial atteint vite ses limites.",
    faq: [
      {
        q: "La communauté chrétienne sénégalaise est-elle représentée ?",
        a: "Oui, et l'ouverture à la diaspora élargit considérablement les possibilités. Vous pouvez chercher au Sénégal, dans la sous-région ou à l'international.",
      },
      {
        q: "Mes informations restent-elles privées ?",
        a: "Votre profil n'est visible que des membres connectés, jamais des moteurs de recherche. Vous pouvez aussi restreindre votre visibilité aux seules personnes que vous avez choisies, ou mettre votre profil en pause.",
      },
    ],
  },
  {
    slug: "cameroun",
    name: "Cameroun",
    demonym: "camerounaise",
    flag: "🇨🇲",
    title: "Rencontre chrétienne au Cameroun — Douala, Yaoundé, Bafoussam",
    metaDescription:
      "Site de rencontre chrétien au Cameroun. Célibataires chrétiens de Douala, Yaoundé et Bafoussam en quête d'un mariage selon la foi.",
    intro:
      "Du littoral aux hauts plateaux de l'Ouest, le Cameroun est profondément marqué par le christianisme. Eden Rencontre y réunit des célibataires qui veulent un foyer bâti sur cette foi.",
    cities: ["Douala", "Yaoundé", "Bafoussam", "Bamenda", "Garoua", "Buea", "Kribi", "Ngaoundéré"],
    paysage:
      "Le Cameroun réunit catholiques, protestants — presbytériens, baptistes, évangéliques luthériens — et un mouvement pentecôtiste en forte croissance dans les grandes villes. La dimension bilingue du pays ajoute une réalité concrète : les communautés anglophones et francophones se croisent parfois peu, y compris entre chrétiens d'une même ville.",
    conseil:
      "Ne réduisez pas votre recherche à votre région ou à votre langue d'usage. Beaucoup de couples camerounais se sont formés entre le Nord-Ouest et le Littoral, ou entre Douala et la diaspora — la proximité géographique n'est pas le premier critère d'une union durable.",
    faq: [
      {
        q: "Puis-je chercher dans une ville précise ?",
        a: "Oui. Vous pouvez rencontrer des membres de votre ville comme du reste du pays et de la diaspora : la ville de chacun est indiquée sur son profil.",
      },
      {
        q: "Les appels vidéo sont-ils disponibles ?",
        a: "Les appels audio et vidéo sont accessibles avec la formule Premium. C'est souvent l'étape qui rassure avant une première rencontre.",
      },
    ],
  },
  {
    slug: "burkina-faso",
    name: "Burkina Faso",
    demonym: "burkinabè",
    flag: "🇧🇫",
    title: "Rencontre chrétienne au Burkina Faso — Ouagadougou, Bobo-Dioulasso",
    metaDescription:
      "Rencontres chrétiennes sérieuses au Burkina Faso. Célibataires chrétiens de Ouagadougou et Bobo-Dioulasso orientés vers le mariage.",
    intro:
      "Au Burkina Faso, la coexistence religieuse fait partie du quotidien. Pour un célibataire chrétien, cela rend d'autant plus importante la clarté sur ce que l'on cherche.",
    cities: ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Ouahigouya", "Banfora", "Kaya"],
    paysage:
      "Les chrétiens burkinabè, catholiques comme protestants évangéliques, vivent au sein d'une société majoritairement musulmane, dans une tradition de cohabitation ancienne et largement pacifique. Les familles y accordent une place déterminante à la validation du choix du conjoint, ce qui rend la question de la foi partagée particulièrement structurante.",
    conseil:
      "Puisque l'entourage familial pèsera dans la décision, mieux vaut avancer avec un socle commun explicite. Une relation où la foi de chacun est claire dès le départ affronte bien mieux le moment des présentations.",
    faq: [
      {
        q: "Comment savoir si une personne pratique réellement ?",
        a: "Le profil indique la confession, la fréquence de participation aux assemblées et le niveau de pratique. Ces éléments donnent une base honnête avant même le premier message.",
      },
      {
        q: "L'inscription est-elle gratuite ?",
        a: "Oui. Vous pouvez créer votre profil, découvrir des membres et échanger sans payer. La formule Premium lève les limites quotidiennes et ouvre les fonctions avancées.",
      },
    ],
  },
  {
    slug: "gabon",
    name: "Gabon",
    demonym: "gabonaise",
    flag: "🇬🇦",
    title: "Rencontre chrétienne au Gabon — Libreville, Port-Gentil",
    metaDescription:
      "Rencontres chrétiennes au Gabon. Rejoignez des célibataires chrétiens de Libreville et Port-Gentil décidés à fonder un foyer.",
    intro:
      "Le Gabon est très majoritairement chrétien, mais la population est peu nombreuse et concentrée dans quelques villes. Les cercles se recoupent vite.",
    cities: ["Libreville", "Port-Gentil", "Franceville", "Oyem", "Moanda", "Lambaréné"],
    paysage:
      "Le pays est majoritairement catholique, avec une présence protestante et évangélique significative à Libreville et Port-Gentil. La démographie restreinte du Gabon crée une situation particulière : dans une même paroisse, chacun connaît souvent déjà tout le monde, et les célibataires se retrouvent à chercher hors de leur cercle habituel.",
    conseil:
      "Ouvrir sa recherche à la sous-région ou à la diaspora gabonaise n'est pas un aveu d'échec, c'est simplement réaliste dans un pays où le vivier local est vite parcouru.",
    faq: [
      {
        q: "Puis-je rencontrer des personnes hors du Gabon ?",
        a: "Oui, aucune restriction géographique ne s'applique. Beaucoup de membres élargissent volontairement leur recherche à l'Afrique centrale et à la diaspora.",
      },
      {
        q: "Que se passe-t-il quand deux personnes se plaisent mutuellement ?",
        a: "Un match se crée et la conversation s'ouvre. Personne ne peut vous écrire sans que l'intérêt soit réciproque, sauf via un message d'introduction réservé aux formules payantes.",
      },
    ],
  },
  {
    slug: "france",
    name: "France",
    demonym: "française",
    flag: "🇫🇷",
    title: "Rencontre chrétienne en France — diaspora africaine et célibataires chrétiens",
    metaDescription:
      "Rencontre chrétienne en France. Célibataires chrétiens et diaspora africaine à Paris, Lyon, Marseille en quête d'un mariage selon la foi.",
    intro:
      "En France, beaucoup de chrétiens issus de la diaspora africaine cherchent un conjoint qui partage à la fois leur foi et leur culture. C'est une double exigence, et elle est légitime.",
    cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Lille", "Bordeaux", "Nantes", "Strasbourg"],
    paysage:
      "Les communautés chrétiennes issues de l'immigration africaine sont très actives en Île-de-France, dans le Rhône et les Bouches-du-Rhône : assemblées évangéliques, paroisses catholiques africaines, Églises de réveil. Ces communautés sont vivantes, mais souvent dispersées à l'échelle d'une agglomération, ce qui rend les rencontres moins spontanées qu'il n'y paraît.",
    conseil:
      "Chercher quelqu'un qui partage la foi ET la culture réduit mécaniquement le nombre de personnes rencontrées au quotidien. C'est exactement le genre de recherche où une plateforme ciblée change la donne, en reliant la France au continent.",
    faq: [
      {
        q: "Puis-je chercher à la fois en France et en Afrique ?",
        a: "Oui. Beaucoup de membres en France élargissent leur recherche à leur pays d'origine, et inversement. Les appels audio et vidéo permettent de bâtir une vraie relation malgré la distance.",
      },
      {
        q: "Quels moyens de paiement sont acceptés ?",
        a: "Carte bancaire Visa et Mastercard depuis la France, et Mobile Money depuis l'Afrique. Les moyens proposés s'adaptent automatiquement à votre indicatif téléphonique.",
      },
    ],
  },
];

export function getCountry(slug: string): Country | undefined {
  return COUNTRIES.find(c => c.slug === slug);
}
