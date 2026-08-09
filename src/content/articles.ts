/**
 * Articles du blog.
 *
 * Contenu stocké en code plutôt qu'en base : ces textes changent rarement,
 * doivent être rendus côté serveur pour être indexés, et n'ont pas besoin
 * d'interface d'édition. Une table Supabase ajouterait une requête réseau
 * et un risque de page vide au chargement, pour aucun gain.
 *
 * Chaque article vise une intention de recherche réelle. Un blog n'apporte
 * rien s'il parle de ce que l'entreprise a envie de dire ; il fonctionne
 * quand il répond à ce que les gens cherchent déjà.
 */

export type Section = { heading: string; body: string[] };

export type Article = {
  slug: string;
  title: string;
  metaDescription: string;
  excerpt: string;
  publishedAt: string; // ISO
  readingMinutes: number;
  category: string;
  intro: string;
  sections: Section[];
  conclusion: string;
};

export const ARTICLES: Article[] = [
  {
    slug: "reconnaitre-relation-saine-chretienne",
    title: "Comment reconnaître une relation saine avant le mariage",
    metaDescription:
      "Cinq signes concrets d'une relation chrétienne saine avant le mariage, et les signaux qui doivent alerter. Repères pratiques pour discerner.",
    excerpt:
      "L'attirance ne dit rien de la solidité d'une relation. Voici les signes qui distinguent une relation qui construit d'une relation qui use.",
    publishedAt: "2026-08-04",
    readingMinutes: 6,
    category: "Discernement",
    intro:
      "Beaucoup de ruptures douloureuses n'arrivent pas par surprise. Les signaux étaient là, mais on les a interprétés comme des difficultés passagères plutôt que comme ce qu'ils étaient. Apprendre à lire une relation demande de regarder des comportements, pas des intentions déclarées.",
    sections: [
      {
        heading: "1. Vous pouvez être en désaccord sans que tout vacille",
        body: [
          "Un couple sain n'est pas un couple sans conflit. C'est un couple où le désaccord ne menace pas le lien. Si chaque divergence provoque une crise, un silence de plusieurs jours ou une menace de rupture, ce n'est pas de l'intensité — c'est de la fragilité.",
          "Observez ce qui se passe après une dispute. Le sujet est-il traité, ou seulement enterré ? Une relation qui ne sait pas réparer accumule, et ce qui s'accumule finit toujours par déborder.",
        ],
      },
      {
        heading: "2. Votre foi grandit au lieu de se diluer",
        body: [
          "C'est un critère que peu de gens osent regarder en face. Depuis que cette relation existe, priez-vous plus ou moins ? Votre vie d'assemblée s'est-elle enrichie ou espacée ?",
          "Une relation qui vous éloigne progressivement de ce qui vous fait tenir n'est pas neutre, même si personne n'a rien demandé explicitement. À l'inverse, une personne qui vous encourage sans vous surveiller est un signe fort.",
        ],
      },
      {
        heading: "3. Vos proches ne sont pas mis à distance",
        body: [
          "L'isolement progressif est le mécanisme le plus constant des relations qui abîment. Il commence rarement par une interdiction : il commence par des remarques sur vos amis, des reproches après chaque visite en famille, une fatigue systématique le jour d'une sortie.",
          "Demandez-vous simplement si votre cercle s'est rétréci depuis le début de la relation. Si oui, nommez-le — et écoutez la réponse.",
        ],
      },
      {
        heading: "4. Les projets sont dits, pas supposés",
        body: [
          "Après plusieurs mois, vous devriez pouvoir répondre à des questions simples : cette personne veut-elle se marier, et dans quel horizon ? Souhaite-t-elle des enfants ? Où envisage-t-elle de vivre ?",
          "Si ces réponses restent floues malgré vos tentatives, le flou est lui-même une réponse. Une personne qui se projette avec vous le formule ; celle qui esquive après un an d'esquives continuera d'esquiver.",
        ],
      },
      {
        heading: "5. Vous n'avez pas à vous justifier d'exister",
        body: [
          "Dans une relation saine, vos limites sont accueillies. Dire « je ne suis pas prêt pour cela » ne devrait pas déclencher de négociation, de bouderie ni de culpabilisation.",
          "Si chaque limite posée doit être défendue comme au tribunal, ce n'est pas un problème de communication : c'est un problème de respect.",
        ],
      },
    ],
    conclusion:
      "Aucun de ces signes n'est un verdict isolé. Mais s'ils s'accumulent, ils dessinent une trajectoire — et cette trajectoire ne s'inverse pas par la seule force du sentiment. Le meilleur moment pour se poser ces questions, c'est avant l'engagement, quand y répondre honnêtement coûte encore peu.",
  },
  {
    slug: "questions-avant-de-se-marier",
    title: "Les 12 questions à poser avant de dire oui",
    metaDescription:
      "Douze questions concrètes à aborder avant le mariage chrétien : argent, famille, foi, enfants, conflits. Une conversation qui évite bien des drames.",
    excerpt:
      "Ces conversations sont inconfortables. Elles le sont infiniment moins avant le mariage qu'après.",
    publishedAt: "2026-08-04",
    readingMinutes: 7,
    category: "Préparation au mariage",
    intro:
      "La plupart des couples parlent longuement de leurs sentiments et très peu de leur organisation. C'est pourtant sur l'organisation que se joue le quotidien : l'argent, la famille, le temps, les décisions. Voici les questions qu'il vaut mieux poser avant.",
    sections: [
      {
        heading: "L'argent",
        body: [
          "Combien gagnez-vous chacun, et quelles dettes portez-vous ? La question paraît brutale ; elle l'est bien moins que de la découvrir après.",
          "Les comptes seront-ils communs, séparés, ou mixtes ? Qui décide d'une dépense importante, et à partir de quel montant faut-il en parler ?",
          "Quelle place donnez-vous à la dîme et aux offrandes ? C'est un sujet de tension fréquent quand deux pratiques diffèrent.",
        ],
      },
      {
        heading: "La famille",
        body: [
          "Quelle sera votre part d'aide financière à vos familles respectives ? Dans beaucoup de contextes africains, cette attente est réelle et rarement discutée à l'avance — c'est une source majeure de conflits.",
          "Vos familles auront-elles leur mot à dire dans vos décisions de couple, et jusqu'où ?",
          "Où passerez-vous les fêtes ? La question semble anecdotique jusqu'à la première année.",
        ],
      },
      {
        heading: "Les enfants",
        body: [
          "En voulez-vous, combien, et dans quel délai ? Un désaccord sur ce point ne se résout pas par le compromis.",
          "Comment envisagez-vous l'éducation, la discipline, la transmission de la foi ?",
          "Et si les enfants ne venaient pas — qu'êtes-vous prêts à envisager ensemble ?",
        ],
      },
      {
        heading: "La foi",
        body: [
          "Dans quelle assemblée irez-vous ? Si vous venez de dénominations différentes, cette question mérite une réponse claire, pas un « on verra ».",
          "À quoi ressemblera votre vie spirituelle commune : prière ensemble, lecture, service ?",
        ],
      },
      {
        heading: "Le conflit",
        body: [
          "Comment chacun réagit-il en cas de tension — confrontation, retrait, silence ? Connaître le mode de l'autre évite de mal l'interpréter.",
          "Y a-t-il une personne de confiance vers qui vous tourner en cas de blocage sérieux ?",
        ],
      },
    ],
    conclusion:
      "Si ces conversations vous semblent trop lourdes à mener maintenant, c'est une information en soi. Un couple capable de parler d'argent, de belle-famille et de désaccords sans se déchirer est un couple qui a de bonnes chances de tenir. Un couple qui les évite ne les évitera pas éternellement — il les subira.",
  },
  {
    slug: "rencontre-chretienne-en-ligne-precautions",
    title: "Rencontre chrétienne en ligne : les précautions qui comptent vraiment",
    metaDescription:
      "Comment rencontrer en ligne sans se mettre en danger : repérer les faux profils, protéger ses données, organiser une première rencontre sereine.",
    excerpt:
      "Rencontrer en ligne n'est ni plus ni moins risqué qu'ailleurs. Encore faut-il connaître les quelques réflexes qui changent tout.",
    publishedAt: "2026-08-04",
    readingMinutes: 5,
    category: "Sécurité",
    intro:
      "Chercher un conjoint en ligne s'est banalisé, y compris dans les milieux chrétiens. Mais la confiance qu'inspire un vocabulaire partagé peut baisser la garde : quelqu'un qui cite les Écritures n'est pas nécessairement quelqu'un de bien. Voici les réflexes qui protègent.",
    sections: [
      {
        heading: "Repérer un profil douteux",
        body: [
          "Méfiez-vous d'une seule photo, très flatteuse, sans aucune image du quotidien. Un profil authentique montre plusieurs facettes.",
          "Une bio vide ou faite de généralités — « je cherche une personne sincère » — n'engage à rien. Une vraie personne écrit des choses concrètes.",
          "Le signal le plus fiable reste la précipitation. Déclarations intenses après trois jours, insistance pour quitter la plateforme, urgence à obtenir votre numéro : ce rythme n'est pas celui d'un intérêt sincère.",
        ],
      },
      {
        heading: "La demande d'argent : la règle sans exception",
        body: [
          "Aucune demande d'argent ne se justifie de la part d'une personne rencontrée en ligne, quel que soit le motif invoqué — urgence médicale, frais de transport, problème bancaire.",
          "C'est le scénario le plus répandu, et il fonctionne précisément parce qu'il s'appuie sur la générosité. Se dire chrétien fait partie du dispositif. La réponse est non, systématiquement, sans discussion.",
        ],
      },
      {
        heading: "Avancer par étapes",
        body: [
          "Échangez d'abord par écrit sur la plateforme. Passez ensuite à un appel audio, puis à un appel vidéo. Chaque étape confirme que la personne est bien celle qu'elle prétend.",
          "Un refus persistant d'appel vidéo, après plusieurs semaines et sous des prétextes variés, doit mettre fin aux échanges.",
        ],
      },
      {
        heading: "La première rencontre",
        body: [
          "Choisissez un lieu public et fréquenté, en journée. Prévoyez votre propre moyen de retour.",
          "Prévenez un proche : où vous allez, avec qui, et à quelle heure vous comptez rentrer.",
          "Ne communiquez pas votre adresse avant d'être certain de la personne. Cette prudence n'a rien d'offensant, et quelqu'un de bien intentionné la comprendra.",
        ],
      },
    ],
    conclusion:
      "Ces précautions ne relèvent pas de la méfiance mais du bon sens. Elles vous laissent libre de vous engager pleinement quand la confiance est établie, parce qu'elle l'aura été sur des bases vérifiées plutôt que sur des promesses.",
  },
  {
    slug: "prier-pour-son-futur-conjoint",
    title: "Prier pour son futur conjoint sans tomber dans l'attente passive",
    metaDescription:
      "Comment concilier prière et démarche active dans la recherche d'un conjoint chrétien. Sortir du piège de l'attente sans agir.",
    excerpt:
      "Attendre en priant et attendre sans rien faire ne produisent pas les mêmes résultats. La différence mérite d'être nommée.",
    publishedAt: "2026-08-04",
    readingMinutes: 5,
    category: "Vie spirituelle",
    intro:
      "Beaucoup de célibataires chrétiens vivent une tension inconfortable : on leur répète de faire confiance et d'attendre, tandis que les années passent. Cette tension vient souvent d'une confusion entre confier et s'abstenir.",
    sections: [
      {
        heading: "La confiance n'est pas l'immobilité",
        body: [
          "Confier sa recherche ne dispense pas d'y participer. Dans les récits bibliques, les rencontres arrivent rarement à des gens restés chez eux : elles surviennent en chemin, au puits, au champ, au travail.",
          "S'inscrire sur une plateforme, accepter une invitation, rejoindre un groupe : ce ne sont pas des marques de défiance, ce sont des chemins.",
        ],
      },
      {
        heading: "Prier pour devenir, pas seulement pour recevoir",
        body: [
          "La prière la plus utile n'est pas toujours « envoie-moi quelqu'un », mais « rends-moi capable de bâtir avec quelqu'un ».",
          "Cela déplace l'attention vers ce sur quoi vous avez prise : votre patience, votre manière de gérer un conflit, votre rapport à l'argent, votre capacité à écouter. Ce travail-là ne dépend d'aucune rencontre.",
        ],
      },
      {
        heading: "Le célibat n'est pas une salle d'attente",
        body: [
          "Vivre en suspens, en repoussant projets et décisions jusqu'à la rencontre, abîme deux choses à la fois : ces années-là, et la relation à venir.",
          "Une personne épanouie construit mieux qu'une personne en manque. Ce n'est pas une formule : quelqu'un qui attend d'être sauvé de sa solitude choisit rarement bien.",
        ],
      },
      {
        heading: "Discerner sans surinterpréter",
        body: [
          "Chercher des signes dans chaque coïncidence conduit vite à voir des confirmations partout — y compris là où les faits disent le contraire.",
          "Le discernement s'appuie sur des éléments observables : le caractère de la personne, sa réputation, la cohérence entre ses paroles et ses actes, l'avis de gens qui vous connaissent bien. Une paix intérieure qui contredit tous ces éléments mérite d'être questionnée.",
        ],
      },
    ],
    conclusion:
      "Priez, et avancez. Les deux ne s'opposent pas — ils se soutiennent. Ce qui use les célibataires, ce n'est pas l'attente elle-même, c'est l'attente sans mouvement.",
  },
  {
    slug: "savoir-si-cest-la-personne-que-dieu-a-choisie",
    title: "Comment savoir si c'est la personne que Dieu a choisie pour moi ?",
    metaDescription:
      "La question que se posent tous les célibataires chrétiens. Quatre repères concrets pour discerner, et pourquoi attendre un signe surnaturel fait souvent perdre des années.",
    excerpt:
      "Beaucoup attendent une certitude absolue avant de s'engager. Cette attente est presque toujours la mauvaise question — voici celle qu'il faut poser à la place.",
    publishedAt: "2026-08-09",
    readingMinutes: 7,
    category: "Discernement",
    intro:
      "C'est la question la plus posée, et celle qui paralyse le plus. On imagine qu'il existe une seule personne prévue, et qu'un signe viendra la désigner sans ambiguïté. Cette représentation crée deux souffrances : l'attente d'une confirmation qui ne vient pas, et la peur permanente de s'être trompé une fois engagé.",
    sections: [
      {
        heading: "La Bible parle de sagesse, pas de révélation",
        body: [
          "Les Écritures donnent beaucoup de critères sur le conjoint — le caractère, la foi partagée, la fidélité, la capacité à travailler et à protéger. Elles ne décrivent nulle part une méthode pour identifier une personne unique désignée d'avance.",
          "Ce silence n'est pas un oubli. Il indique que le choix relève du discernement, pas de la loterie. La question n'est donc pas « est-ce la bonne personne ? » mais « cette personne réunit-elle ce que l'Écriture demande, et suis-je prêt à construire avec elle ? »",
        ],
      },
      {
        heading: "Le caractère se voit dans la contrainte, pas dans le confort",
        body: [
          "Tout le monde est agréable au début. Ce qui informe, c'est le comportement sous pression : quand il y a un désaccord, un retard, un manque d'argent, une fatigue.",
          "Observez comment la personne traite ceux qui ne peuvent rien lui apporter — un serveur, un vendeur, un cadet. C'est là que le caractère réel apparaît, bien plus que dans ce qu'elle vous dit d'elle-même.",
          "Observez aussi la constance. Quelqu'un qui change de version, d'humeur ou de projet selon l'interlocuteur ne deviendra pas stable après le mariage.",
        ],
      },
      {
        heading: "La foi partagée n'est pas une case à cocher",
        body: [
          "Deux personnes peuvent se dire chrétiennes et vivre leur foi de manière incompatible. L'une prie chaque matin, l'autre va au culte trois fois par an. L'une donne la dîme, l'autre trouve cela excessif.",
          "Ces écarts ne se règlent pas par l'amour. Ils se règlent avant, en parlant concrètement : quelle place pour la prière dans le foyer, quelle assemblée fréquenter, comment élever les enfants dans la foi.",
        ],
      },
      {
        heading: "L'avis de ceux qui vous connaissent vaut plus qu'un sentiment",
        body: [
          "Vos parents, votre pasteur, vos amis proches vous voient de l'extérieur. Ils remarquent ce que l'attachement vous empêche de voir.",
          "Quand plusieurs personnes qui vous aiment expriment la même réserve, ce n'est presque jamais de la jalousie. C'est le signal le plus fiable dont vous disposez, et le plus souvent ignoré.",
        ],
      },
      {
        heading: "La paix intérieure : un indice, jamais une preuve",
        body: [
          "Une paix profonde et durable, qui résiste à l'examen des faits, compte. Une paix qui contredit tous les éléments observables mérite d'être questionnée : elle vient parfois du soulagement de ne plus être seul, pas de Dieu.",
          "Le test est simple : votre paix survit-elle quand vous énumérez honnêtement les difficultés ? Si elle disparaît dès qu'on regarde les faits en face, ce n'était pas de la paix.",
        ],
      },
    ],
    conclusion:
      "La bonne question n'est pas « est-ce la personne prévue ? » mais « est-ce une personne avec qui je peux honorer Dieu toute une vie ? ». La première attend une certitude qui ne viendra pas. La seconde s'examine, se vérifie, et se décide.",
  },
  {
    slug: "reconnaitre-arnaque-sentimentale-en-ligne",
    title: "Arnaque sentimentale en ligne : les signes qui ne trompent pas",
    metaDescription:
      "Comment reconnaître une arnaque sentimentale sur un site de rencontre. Les huit signaux d'alerte, la règle absolue, et quoi faire si vous êtes déjà engagé.",
    excerpt:
      "Aucune demande d'argent n'est légitime, quelle que soit l'histoire. Voici les signaux qui apparaissent bien avant la demande, et comment réagir.",
    publishedAt: "2026-08-12",
    readingMinutes: 8,
    category: "Sécurité",
    intro:
      "L'arnaque sentimentale suit toujours le même déroulé : un lien affectif construit vite, une confiance installée, puis une urgence qui exige de l'argent. Les personnes visées ne sont pas naïves — elles sont seules, et l'escroc travaille précisément cette solitude. Connaître le schéma suffit souvent à s'en protéger.",
    sections: [
      {
        heading: "La règle absolue, avant tout le reste",
        body: [
          "N'envoyez jamais d'argent à quelqu'un que vous n'avez pas rencontré physiquement. Aucune exception, aucune circonstance, aucun montant.",
          "Ni pour un billet d'avion, ni pour des frais de douane, ni pour une hospitalisation, ni pour débloquer un héritage. Ces quatre prétextes couvrent la quasi-totalité des cas.",
          "Cette règle protège aussi vos relations sincères : une personne honnête comprendra, et n'insistera pas.",
        ],
      },
      {
        heading: "Huit signaux d'alerte",
        body: [
          "Les sentiments arrivent trop vite. « Je t'aime » après une semaine, des projets de mariage après quinze jours. L'attachement rapide est l'outil principal de l'escroc.",
          "Le passage immédiat hors de la plateforme. On vous presse de continuer sur WhatsApp — là où aucune modération n'existe et où aucun signalement n'est possible.",
          "Les appels vidéo sont toujours évités. Caméra cassée, connexion mauvaise, travail en mer, mission militaire. Une personne réelle finit par accepter.",
          "Les photos sont trop parfaites. Faites une recherche d'image inversée : beaucoup proviennent de comptes publics volés.",
          "Le français est irrégulier — excellent dans certaines phrases, incohérent dans d'autres. Signe de messages copiés depuis un modèle.",
          "La profession est lointaine et invérifiable : chirurgien en mission, ingénieur pétrolier offshore, militaire en opération.",
          "Une urgence apparaît, toujours après l'attachement, jamais avant.",
          "On vous demande le secret. « N'en parle à personne, ils ne comprendraient pas. » C'est le signal le plus grave : l'isolement est indispensable à l'escroquerie.",
        ],
      },
      {
        heading: "Pourquoi les chrétiens sont particulièrement visés",
        body: [
          "Les escrocs citent des versets, parlent de prière, promettent un mariage devant Dieu. Ce vocabulaire désarme la méfiance plus vite que tout autre.",
          "Retenez ceci : un discours spirituel n'est pas une garantie de caractère. La foi se vérifie dans la durée et dans les actes, pas dans le vocabulaire.",
        ],
      },
      {
        heading: "Si vous êtes déjà engagé",
        body: [
          "Arrêtez tout envoi d'argent immédiatement, même si l'on vous promet un remboursement imminent. La promesse de remboursement fait partie du procédé.",
          "Parlez-en à quelqu'un. La honte est le principal allié de l'escroc : tant que vous vous taisez, vous restez seul face à lui.",
          "Signalez le profil. Chaque signalement protège les suivants, et la plupart des escrocs opèrent sur plusieurs cibles simultanément.",
          "Conservez les échanges et les preuves de virement, puis déposez plainte. Les chances de récupération sont faibles, mais les signalements permettent de démanteler les réseaux.",
        ],
      },
      {
        heading: "Ce qui protège vraiment",
        body: [
          "Restez sur la plateforme tant que la confiance n'est pas établie. Les échanges y sont modérés, et un profil signalé peut être suspendu.",
          "Passez à l'appel vidéo tôt. Cinq minutes suffisent à écarter la grande majorité des faux profils.",
          "Parlez de vos rencontres à un proche. Quelqu'un d'extérieur repère en une phrase ce que l'attachement vous cache.",
        ],
      },
    ],
    conclusion:
      "Une relation sincère résiste à la prudence. Si quelqu'un se vexe parce que vous prenez votre temps, refusez d'envoyer de l'argent ou souhaitez en parler à vos proches, la question est réglée.",
  },
  {
    slug: "ce-que-dit-la-bible-sur-les-frequentations",
    title: "Ce que dit la Bible sur les fréquentations avant le mariage",
    metaDescription:
      "La Bible ne parle pas de « fréquentations » au sens moderne. Voici les principes qu'elle donne réellement, et comment les appliquer aujourd'hui sans légalisme.",
    excerpt:
      "Le mot n'existe pas dans les Écritures. Les principes, eux, sont clairs — et plus praticables que les règles qu'on entend souvent.",
    publishedAt: "2026-08-15",
    readingMinutes: 7,
    category: "Vie spirituelle",
    intro:
      "Chercher un chapitre biblique sur les fréquentations ne donne rien : la période de découverte avant le mariage, telle que nous la vivons, n'existait pas dans les cultures bibliques. Cela ne signifie pas que l'Écriture est muette. Elle donne des principes, applicables à toute relation, qui valent mieux que les listes de règles souvent transmises.",
    sections: [
      {
        heading: "Le but oriente tout le reste",
        body: [
          "L'Écriture ne connaît pas la relation sans direction. On se rapproche de quelqu'un en vue d'une union, pas pour occuper une saison.",
          "Ce cadre simplifie beaucoup de questions. Une relation qui n'a aucune perspective de mariage après un temps raisonnable n'est pas neutre : elle occupe une place, mobilise des sentiments, et retarde deux personnes.",
        ],
      },
      {
        heading: "La pureté n'est pas qu'une affaire de corps",
        body: [
          "Le Nouveau Testament traite l'intégrité sexuelle avec sérieux, mais il parle tout autant de la façon dont on traite l'autre : sans manipulation, sans mensonge, sans utiliser quelqu'un pour se rassurer.",
          "Une relation peut être irréprochable physiquement et profondément malhonnête émotionnellement. Entretenir l'espoir de quelqu'un sans intention réelle est une forme d'impureté dont on parle rarement.",
        ],
      },
      {
        heading: "Le conseil des anciens n'est pas une formalité",
        body: [
          "« Le salut est dans le grand nombre des conseillers. » Le principe traverse les Proverbes.",
          "Concrètement : présentez la personne à vos parents, à votre pasteur, à des amis mûrs. Non pour obtenir une autorisation, mais parce qu'ils voient ce que vous ne voyez pas.",
          "Une relation qu'on cache à tous ceux qui nous aiment pose une question qui ne se réglera pas d'elle-même.",
        ],
      },
      {
        heading: "Le joug mal assorti : ce que le texte dit et ne dit pas",
        body: [
          "Le passage est souvent réduit à « ne pas épouser un non-chrétien ». Le sens est plus large : ne pas s'attacher à quelqu'un dont les fondations rendront impossible d'avancer ensemble.",
          "Deux chrétiens peuvent être mal assortis si l'un vit sa foi au centre de tout et l'autre à la marge. Ce n'est pas l'étiquette qui compte, c'est la direction réelle de la vie.",
        ],
      },
      {
        heading: "Ce que l'Écriture ne dit pas",
        body: [
          "Elle ne fixe pas de durée. Elle n'interdit pas de se tenir la main. Elle n'impose pas un chaperon. Elle ne dit rien des applications de rencontre.",
          "Beaucoup de règles présentées comme bibliques sont des traditions — parfois sages, parfois seulement culturelles. Les distinguer évite de charger les consciences au-delà de ce que le texte demande.",
        ],
      },
    ],
    conclusion:
      "Une intention claire, l'honnêteté, le conseil des proches, une foi réellement partagée. Ces quatre principes couvrent l'essentiel, et laissent à chaque couple la liberté de fixer ses propres limites devant Dieu.",
  },
  {
    slug: "premier-message-rencontre-chretienne",
    title: "Premier message : ce qui obtient une réponse",
    metaDescription:
      "Pourquoi « Salut » n'obtient jamais de réponse, et comment écrire un premier message qui en obtient une. Exemples concrets pour une rencontre chrétienne.",
    excerpt:
      "La différence entre un message ignoré et un message qui lance une conversation tient à une chose : avoir lu le profil.",
    publishedAt: "2026-08-18",
    readingMinutes: 5,
    category: "Conseils pratiques",
    intro:
      "Le premier message décide de tout, et la plupart sont perdus d'avance. Non parce qu'ils sont mal écrits, mais parce qu'ils n'appellent aucune réponse. Comprendre ce mécanisme change complètement les résultats.",
    sections: [
      {
        heading: "Pourquoi « Salut » ne fonctionne jamais",
        body: [
          "Un message qui ne contient aucune information n'appelle aucune réponse. La personne devrait fournir seule tout l'effort de démarrage.",
          "Ces messages signalent aussi que vous n'avez pas lu le profil — donc que vous écrivez la même chose à tout le monde. Sur une plateforme orientée vers le mariage, c'est exactement le contraire du signal recherché.",
        ],
      },
      {
        heading: "La règle : relever un détail, poser une vraie question",
        body: [
          "Un premier message efficace tient en trois éléments : une salutation, un détail précis relevé dans le profil, une question ouverte qui s'y rattache.",
          "Le détail prouve que vous avez lu. La question ouverte donne quelque chose à quoi répondre. C'est tout.",
        ],
      },
      {
        heading: "Trois exemples",
        body: [
          "« Bonjour Marie. Vous écrivez que vous cherchez quelqu'un qui prie avant de décider. C'est rare de le voir formulé aussi clairement. Comment cela se traduit-il dans votre quotidien ? »",
          "« Bonjour Jean-Baptiste. Vous fréquentez les Assemblées de Dieu à Adidogomé — je suis dans la même ville. Depuis combien de temps y êtes-vous ? »",
          "« Bonjour Grâce. Votre vision du mariage m'a arrêté, surtout le passage sur la patience. Qu'est-ce qui vous a amenée à écrire cela ? »",
        ],
      },
      {
        heading: "Ce qu'il faut éviter",
        body: [
          "Les compliments sur le physique en ouverture. Ils placent la relation sur un terrain dont vous cherchez précisément à sortir.",
          "Les messages trop longs. Un paragraphe suffit ; un texte de dix lignes met la pression.",
          "Le vocabulaire spirituel appuyé dès la première phrase. Annoncer une prophétie sur votre union avant même de vous être parlé fait fuir, y compris des personnes très croyantes.",
          "Les fautes d'inattention. Relisez : un message soigné dit que la personne compte.",
        ],
      },
      {
        heading: "Et si personne ne répond ?",
        body: [
          "Un profil incomplet reçoit peu de réponses, quel que soit le message : la personne n'a rien pour évaluer si l'échange vaut la peine.",
          "Complétez le vôtre avant d'écrire beaucoup. Une photo nette, votre vision du mariage, ce que vous recherchez. Le taux de réponse change du tout au tout.",
        ],
      },
    ],
    conclusion:
      "Écrivez moins de messages, mais lisez les profils. Cinq messages personnalisés obtiennent plus que cinquante messages identiques — et les conversations qui en naissent vont beaucoup plus loin.",
  },
  {
    slug: "presenter-son-futur-conjoint-a-sa-famille",
    title: "Présenter son futur conjoint à sa famille : comment s'y prendre",
    metaDescription:
      "En Afrique, la famille ne valide pas seulement une union : elle y participe. Comment préparer la présentation, dans quel ordre, et que faire en cas de réticence.",
    excerpt:
      "Le moment est décisif, et il se prépare. Voici l'ordre à respecter et les erreurs qui coûtent le plus cher.",
    publishedAt: "2026-08-21",
    readingMinutes: 7,
    category: "Préparation au mariage",
    intro:
      "Dans la plupart des cultures africaines, on n'épouse pas une personne : on épouse une famille. La présentation n'est donc pas une formalité affective, c'est une étape structurante. Mal conduite, elle laisse des tensions que des années ne suffisent pas à effacer.",
    sections: [
      {
        heading: "Attendre le bon moment, mais pas trop",
        body: [
          "Trop tôt, la présentation officialise une relation qui n'a pas encore fait ses preuves, et rend une rupture douloureuse pour tout le monde.",
          "Trop tard, la famille apprend l'existence de la relation par d'autres, ce qui est reçu comme un manque de respect — et démarre l'histoire sur une blessure.",
          "Le repère raisonnable : quand vous êtes tous les deux certains de vouloir avancer vers le mariage, avant d'entamer les démarches.",
        ],
      },
      {
        heading: "Respecter l'ordre",
        body: [
          "Dans la plupart des familles, l'ordre compte autant que le fait lui-même. Souvent : d'abord un aîné ou une tante de confiance, qui prépare le terrain, puis les parents.",
          "Sauter une étape ou passer par-dessus la tête de quelqu'un crée des vexations durables. En cas de doute, demandez à un aîné de votre propre famille quel est l'usage.",
        ],
      },
      {
        heading: "Préparer la personne, pas seulement l'événement",
        body: [
          "Expliquez à votre futur conjoint qui sera présent, quel est le rôle de chacun, ce qui se fait et ce qui ne se fait pas.",
          "Prévenez-le des questions attendues : la famille, le travail, la confession, les intentions. Elles ne sont pas hostiles — elles sont l'équivalent d'un entretien, et elles sont normales.",
          "Convenez ensemble de ce que vous direz sur votre situation, pour ne pas vous contredire devant tout le monde.",
        ],
      },
      {
        heading: "Si la famille est réticente",
        body: [
          "Écoutez d'abord la raison réelle. Une objection sur la région d'origine, la confession ou la situation financière ne se traite pas de la même façon qu'une inquiétude sur le caractère.",
          "Ne mettez personne devant un ultimatum. Une famille qui se sent forcée campe sur sa position, souvent des années.",
          "Faites intervenir un tiers respecté — un ancien, un pasteur, un oncle. Une parole extérieure passe mieux qu'une insistance de votre part.",
          "Distinguez la réserve du refus. Beaucoup de réticences s'estompent quand la famille connaît réellement la personne.",
        ],
      },
      {
        heading: "Ce qui compte pour un couple chrétien",
        body: [
          "L'Écriture demande d'honorer ses parents ; elle dit aussi que l'homme quitte son père et sa mère pour s'attacher à sa femme. Les deux sont vrais.",
          "Honorer ne signifie pas obéir en tout. Cela signifie écouter avec respect, expliquer sa décision, et rester en relation même en cas de désaccord.",
          "Priez ensemble avant la présentation. Pas comme une formalité : cela ramène le couple à ce qu'il cherche, et calme beaucoup d'appréhension.",
        ],
      },
    ],
    conclusion:
      "Une présentation bien menée fait gagner des années de paix. Prenez le temps de comprendre les usages de chaque famille, respectez l'ordre, et n'imposez rien : ce qui se construit dans le respect tient beaucoup plus longtemps.",
  },
  {
    slug: "mariage-entre-confessions-differentes",
    title: "Se marier entre confessions différentes : ce qu'il faut regarder",
    metaDescription:
      "Catholique et protestant, évangélique et pentecôtiste : ce que change réellement une différence de confession dans un mariage chrétien, et les questions à trancher avant.",
    excerpt:
      "La confession compte moins que la pratique. Voici les cinq questions à régler avant, pas après.",
    publishedAt: "2026-08-24",
    readingMinutes: 6,
    category: "Préparation au mariage",
    intro:
      "Deux chrétiens de confessions différentes peuvent bâtir un foyer solide. Beaucoup l'ont fait. Mais les difficultés n'apparaissent pas là où on les attend : rarement dans la doctrine, presque toujours dans le quotidien — l'assemblée du dimanche, l'éducation des enfants, la place de la belle-famille.",
    sections: [
      {
        heading: "La pratique compte plus que l'étiquette",
        body: [
          "Un catholique qui prie chaque jour et un pentecôtiste tiède auront plus de mal à s'accorder que deux personnes de confessions différentes mais d'engagement comparable.",
          "La vraie question n'est pas « quelle Église ? » mais « quelle place la foi occupe-t-elle réellement dans votre semaine ? ». Comparez les emplois du temps, pas les étiquettes.",
        ],
      },
      {
        heading: "Cinq questions à trancher avant",
        body: [
          "Où irez-vous le dimanche ? Ensemble dans une seule assemblée, chacun dans la sienne, ou en alternance ? Aucune réponse n'est mauvaise, mais l'absence de réponse en est une.",
          "Dans quelle tradition les enfants seront-ils élevés ? C'est le point qui provoque le plus de conflits, et il se pose bien avant leur naissance.",
          "Qui célèbre le mariage, et selon quel rite ? Renseignez-vous tôt : certaines Églises posent des conditions.",
          "Comment prierez-vous ensemble, à la maison ? Les formes diffèrent beaucoup d'une tradition à l'autre.",
          "Comment répondrez-vous aux familles ? Les deux belles-familles auront un avis. Décidez d'une réponse commune avant qu'on ne vous la demande séparément.",
        ],
      },
      {
        heading: "Les vraies lignes de fracture",
        body: [
          "Elles ne sont presque jamais théologiques. Elles portent sur l'argent donné à l'Église, le temps consacré aux activités d'assemblée, l'autorité reconnue au pasteur ou au prêtre dans les décisions du couple.",
          "Parlez-en avec des exemples chiffrés et datés, pas en principe. « Combien donnons-nous chaque mois ? », « Combien de soirées par semaine à l'église ? » — ces questions concrètes révèlent plus qu'une discussion doctrinale.",
        ],
      },
      {
        heading: "Ce qui rend l'union viable",
        body: [
          "Un respect réel de la tradition de l'autre, pas une tolérance polie. Se moquer d'une pratique, même gentiment, use plus vite qu'on ne le croit.",
          "Un accord écrit sur les cinq questions ci-dessus, pris avant le mariage, en présence d'un tiers de confiance si possible.",
          "L'accord des deux familles, ou au minimum leur neutralité. Une belle-famille hostile à la confession de l'autre pèse lourd sur la durée.",
        ],
      },
    ],
    conclusion:
      "La différence de confession n'est pas un obstacle en soi. L'obstacle, c'est de repousser les questions difficiles en espérant que l'amour les résoudra. Réglez-les avant : c'est plus inconfortable maintenant, et beaucoup plus simple ensuite.",
  },
  {
    slug: "celibat-chretien-attendre-sans-desesperer",
    title: "Célibat chrétien : attendre sans se décourager",
    metaDescription:
      "Comment vivre une saison de célibat prolongée sans amertume ni résignation. Repères pour les célibataires chrétiens qui attendent depuis longtemps.",
    excerpt:
      "L'attente use surtout quand elle est vide. Ce qui change tout, ce n'est pas la durée — c'est ce qu'on en fait.",
    publishedAt: "2026-08-27",
    readingMinutes: 6,
    category: "Vie spirituelle",
    intro:
      "Il y a une différence entre attendre et subir. Beaucoup de célibataires chrétiens portent une fatigue particulière : celle des années qui passent, des questions de l'entourage, et du sentiment d'être en attente d'une vie qui n'a pas commencé. Cette fatigue mérite d'être prise au sérieux, sans être noyée sous des encouragements creux.",
    sections: [
      {
        heading: "Nommer ce qui pèse réellement",
        body: [
          "Ce n'est pas toujours la solitude. C'est souvent le regard des autres, les questions répétées aux mariages, la sensation d'être en retard sur un calendrier que personne n'a écrit.",
          "Distinguer ces sources aide : on ne traite pas de la même façon un manque affectif et une pression sociale.",
        ],
      },
      {
        heading: "Le célibat n'est pas une salle d'attente",
        body: [
          "Ce que vous construisez maintenant — un métier, des amitiés solides, une vie spirituelle, une stabilité financière — ne sera pas perdu. C'est exactement ce sur quoi un mariage s'appuiera.",
          "L'inverse est vrai aussi : ce qui n'est pas réglé pendant le célibat ne se règle pas par le mariage. Les dettes, les blessures anciennes, les colères non traitées entrent dans le foyer avec vous.",
        ],
      },
      {
        heading: "Attendre n'est pas ne rien faire",
        body: [
          "Prier pour un conjoint et ne rien changer à sa vie, c'est espérer une réponse en fermant la porte.",
          "Rencontrer des gens, élargir son cercle, se rendre visible dans son assemblée, s'inscrire là où d'autres cherchent la même chose : rien de tout cela ne contredit la confiance en Dieu. Les deux vont ensemble.",
        ],
      },
      {
        heading: "Se garder de deux dérives",
        body: [
          "L'amertume, qui transforme l'attente en reproche — envers Dieu, envers les couples autour de soi, envers l'autre sexe en général. Elle se voit, et elle éloigne précisément ce qu'on cherche.",
          "Le renoncement aux critères, qui fait accepter n'importe qui par lassitude. Une union bâtie sur la fatigue coûte plus cher que quelques années de plus.",
        ],
      },
      {
        heading: "Ce qui aide concrètement",
        body: [
          "Des amitiés profondes, pas seulement des connaissances. La solitude affective se comble en partie par des relations vraies, même non romantiques.",
          "Une occupation qui vous dépasse : servir, enseigner, accompagner. Le sentiment d'inutilité aggrave tout.",
          "Parler à quelqu'un de confiance. Beaucoup portent cela seuls pendant des années, alors que le dire une fois soulage déjà.",
        ],
      },
    ],
    conclusion:
      "L'attente ne dit rien de votre valeur, ni de la faveur de Dieu envers vous. Elle dit seulement que le moment n'est pas venu. Ce que vous en faites, en revanche, façonnera le foyer que vous bâtirez.",
  },
  {
    slug: "rencontre-chretienne-diaspora-africaine",
    title: "Rencontre chrétienne entre la diaspora et le pays",
    metaDescription:
      "Se rencontrer entre l'Afrique et l'Europe ou l'Amérique du Nord : les questions de distance, d'argent et de projet migratoire à régler avant de s'engager.",
    excerpt:
      "Les couples diaspora-pays réussissent souvent. Mais trois sujets doivent être posés très tôt, et ils sont rarement abordés.",
    publishedAt: "2026-08-30",
    readingMinutes: 7,
    category: "Préparation au mariage",
    intro:
      "Beaucoup de chrétiens installés en France, au Canada, en Belgique ou aux États-Unis cherchent un conjoint au pays, et réciproquement. Ces unions fonctionnent, souvent très bien. Elles échouent quand trois sujets sont évités par délicatesse — alors qu'ils décident de tout.",
    sections: [
      {
        heading: "Premier sujet : le projet migratoire",
        body: [
          "Qui rejoint qui ? La question doit être posée directement, dès les premières semaines sérieuses.",
          "Elle est inconfortable parce qu'elle touche à un soupçon fréquent : « me veut-on pour moi ou pour mes papiers ? ». Ne pas la poser ne fait pas disparaître le soupçon, elle le laisse grandir en silence.",
          "Une réponse claire des deux côtés — même si elle est « je ne sais pas encore » — vaut mieux qu'un non-dit qui pèsera pendant des mois.",
        ],
      },
      {
        heading: "Deuxième sujet : l'argent",
        body: [
          "L'écart de revenus est réel, et il crée des attentes des deux côtés — parfois portées par les familles plus que par les intéressés.",
          "Décidez tôt de ce qui est envoyé, à qui, et selon quelle régularité. Un couple qui n'en a jamais parlé découvre le sujet au pire moment, généralement après le mariage.",
          "Attention aux demandes qui arrivent avant toute rencontre physique : c'est le schéma classique de l'arnaque sentimentale, et la distance en est le terrain favori.",
        ],
      },
      {
        heading: "Troisième sujet : le rythme et la durée",
        body: [
          "Combien de temps avant de se rencontrer physiquement ? Combien de visites par an ? Combien de temps la distance peut-elle durer avant de devenir insupportable ?",
          "Fixez un horizon, même approximatif. Les relations à distance sans échéance s'épuisent : ce n'est pas un manque d'amour, c'est une usure mécanique.",
        ],
      },
      {
        heading: "Ce qui rend ces couples solides",
        body: [
          "Des appels vidéo réguliers plutôt que des messages permanents. Voir le visage change la nature du lien.",
          "Une rencontre physique aussi tôt que possible. Tant qu'elle n'a pas eu lieu, la relation repose sur une image.",
          "L'implication des deux familles de part et d'autre, malgré la distance. Une visite au pays qui inclut la famille vaut dix mois d'échanges.",
          "Une assemblée de rattachement pour chacun. L'isolement spirituel guette celui qui est parti autant que celui qui reste.",
        ],
      },
    ],
    conclusion:
      "La distance n'est pas le vrai obstacle. Ce sont les sujets qu'on évite parce qu'ils gênent. Posez-les tôt, à froid, et vous saurez très vite si la relation tient debout.",
  },
  {
    slug: "dot-et-mariage-chretien-afrique",
    title: "La dot dans un mariage chrétien : comprendre et s'organiser",
    metaDescription:
      "Ce que représente la dot, ce que dit la foi chrétienne à son sujet, et comment préparer les démarches sans que le coût devienne un obstacle au mariage.",
    excerpt:
      "La dot n'est pas un achat. Mais quand son montant repousse le mariage de plusieurs années, la question mérite d'être posée franchement.",
    publishedAt: "2026-09-02",
    readingMinutes: 7,
    category: "Préparation au mariage",
    intro:
      "Dans une grande partie de l'Afrique francophone, le mariage coutumier précède le mariage religieux, et la dot en constitue l'étape centrale. Beaucoup de couples chrétiens s'y heurtent : non par rejet de la tradition, mais parce que les montants demandés repoussent l'union de plusieurs années — parfois au prix de la pureté qu'ils voulaient préserver.",
    sections: [
      {
        heading: "Ce que la dot signifie réellement",
        body: [
          "Elle n'est pas un prix payé pour une personne. Dans sa fonction d'origine, elle scelle une alliance entre deux familles et marque publiquement le sérieux de l'engagement.",
          "Comprendre cette fonction change la discussion : on ne négocie pas un tarif, on organise une reconnaissance mutuelle entre deux lignées.",
        ],
      },
      {
        heading: "Ce que la foi chrétienne en dit",
        body: [
          "L'Écriture connaît des pratiques comparables et ne les condamne pas. Elle ne les impose pas non plus.",
          "Elle demande en revanche d'honorer ses parents, de tenir sa parole, et de ne pas charger les gens de fardeaux impossibles à porter. Ce dernier principe s'applique directement quand une exigence devient un empêchement.",
        ],
      },
      {
        heading: "Quand le montant devient un problème",
        body: [
          "Si la somme demandée impose plusieurs années d'attente, la conséquence est prévisible : soit le couple s'endette, soit il vit ensemble sans être marié, soit il renonce.",
          "Aucune de ces issues ne sert la famille qui a fixé le montant. Le dire ainsi, avec respect, ouvre souvent la discussion mieux qu'une contestation de principe.",
        ],
      },
      {
        heading: "Comment s'organiser concrètement",
        body: [
          "Renseignez-vous tôt sur les usages de la famille, avant même les fiançailles. Le montant, la liste des biens et le calendrier varient beaucoup d'une région et d'une famille à l'autre.",
          "Faites intervenir un aîné médiateur. Dans presque toutes les traditions, la négociation ne se mène pas directement entre les futurs époux.",
          "Demandez un échelonnement si nécessaire. Beaucoup de familles l'acceptent quand la demande est formulée avec respect et par le bon intermédiaire.",
          "Sollicitez votre pasteur ou votre prêtre. Beaucoup ont accompagné des dizaines de familles sur ce sujet et savent quoi dire, et à qui.",
        ],
      },
      {
        heading: "Ce qu'il faut éviter",
        body: [
          "S'endetter lourdement pour tenir un délai. Un foyer qui commence avec une dette impossible démarre avec une tension qui durera des années.",
          "Opposer frontalement foi et tradition. Cette confrontation braque les familles et n'a presque jamais fait avancer un dossier.",
          "Repousser indéfiniment. Une union constamment ajournée finit par se déliter, ou par s'installer dans une situation que le couple n'avait pas choisie.",
        ],
      },
    ],
    conclusion:
      "La dot n'est pas l'ennemie du mariage chrétien. Elle le devient quand elle cesse d'être une alliance pour devenir une barrière. Parlez-en tôt, passez par les bons intermédiaires, et rappelez avec respect que l'objectif partagé reste le mariage — pas son report.",
  },
  {
    slug: "site-rencontre-chretien-gratuit-afrique",
    title: "Site de rencontre chrétien gratuit : ce qu'il faut vérifier",
    metaDescription:
      "Comment choisir une plateforme de rencontre chrétienne en Afrique francophone : les critères de sécurité, de sérieux et de modération à examiner avant de s'inscrire.",
    excerpt:
      "Toutes les plateformes ne se valent pas. Six critères permettent de distinguer un service sérieux d'un annuaire de profils.",
    publishedAt: "2026-09-05",
    readingMinutes: 6,
    category: "Conseils pratiques",
    intro:
      "L'offre s'est multipliée ces dernières années, entre applications généralistes, groupes WhatsApp et plateformes se disant chrétiennes. Toutes ne protègent pas de la même façon, et la gratuité annoncée cache parfois l'essentiel. Voici ce qu'il faut regarder avant de créer un compte.",
    sections: [
      {
        heading: "1. Ce que la gratuité couvre réellement",
        body: [
          "Une inscription gratuite ne dit rien de ce que vous pourrez faire ensuite. Vérifiez ce qui reste accessible sans payer : voir les profils, écrire, répondre à un message reçu.",
          "Une plateforme qui empêche de répondre à quelqu'un qui vous a écrit est un piège commercial, pas un service de rencontre.",
        ],
      },
      {
        heading: "2. La modération existe-t-elle vraiment",
        body: [
          "Cherchez un bouton de signalement sur chaque profil et dans chaque conversation. S'il n'existe pas, personne ne surveille rien.",
          "Vérifiez aussi qu'un blocage empêche réellement l'autre de vous écrire. Sur beaucoup de plateformes, il ne fait que masquer la conversation de votre côté.",
        ],
      },
      {
        heading: "3. Les critères de foi sont-ils réels",
        body: [
          "Une plateforme réellement chrétienne demande la confession, la fréquentation d'assemblée, l'intention de mariage — et permet de filtrer dessus.",
          "Si la foi n'apparaît que dans le nom du service et le logo, vous êtes sur une application généraliste repeinte.",
        ],
      },
      {
        heading: "4. Le sérieux des profils",
        body: [
          "Photo obligatoire, profil complet exigé, vérification d'identité proposée : ces contraintes réduisent les faux profils, même si elles ralentissent l'inscription.",
          "Une plateforme où l'on peut écrire sans photo ni profil rempli attire mécaniquement les escrocs.",
        ],
      },
      {
        heading: "5. Le moyen de paiement",
        body: [
          "En Afrique francophone, une plateforme qui n'accepte que la carte bancaire s'adresse à une minorité. Le Mobile Money est la norme.",
          "Vérifiez aussi l'absence de reconduction automatique : un abonnement qu'on ne peut pas arrêter facilement est un mauvais signe sur le reste.",
        ],
      },
      {
        heading: "6. Le traitement de vos données",
        body: [
          "Lisez la politique de confidentialité, au moins en diagonale. Une plateforme sérieuse dit ce qu'elle conserve, pendant combien de temps, et comment supprimer un compte.",
          "Vérifiez qu'une suppression de compte est possible depuis l'application, sans avoir à écrire à un service client.",
        ],
      },
    ],
    conclusion:
      "Le bon critère n'est pas le prix mais la protection. Une plateforme qui modère, vérifie et bloque réellement vous fera gagner du temps — et vous évitera des expériences dont on met longtemps à se remettre.",
  },
];

/**
 * Publication échelonnée.
 *
 * Un article dont la date est future reste invisible : absent du blog,
 * absent de la page d'accueil, absent du sitemap. Il apparaît tout seul
 * le jour venu.
 *
 * POURQUOI. Écrire dix articles d'un coup et les publier le même jour
 * produit un pic que Google identifie comme une production de masse — et
 * la production de masse est précisément ce que son système de contenu
 * utile déclasse. Un article tous les trois jours est lu comme un rythme
 * éditorial ; dix le lundi, comme un déversement.
 *
 * Cela permet aussi d'écrire un trimestre à l'avance sans que le blog
 * paraisse figé entre deux séances de rédaction.
 *
 * Comparaison de chaînes et non de `Date` : `publishedAt` est au format
 * ISO, où l'ordre alphabétique est déjà l'ordre chronologique. On évite
 * ainsi toute question de fuseau horaire — un article daté du 12 ne doit
 * pas apparaître le 11 au soir pour un lecteur à l'ouest.
 */
export function articlesPublies(aujourdhui = new Date().toISOString().slice(0, 10)): Article[] {
  return ARTICLES
    .filter(a => a.publishedAt <= aujourdhui)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * Un article par son identifiant d'URL.
 *
 * Ne renvoie rien tant que la date de publication n'est pas atteinte :
 * sans ce contrôle, une adresse devinée donnerait accès à un texte non
 * encore publié.
 */
export function getArticle(slug: string): Article | undefined {
  const a = ARTICLES.find(x => x.slug === slug);
  if (!a) return undefined;
  return a.publishedAt <= new Date().toISOString().slice(0, 10) ? a : undefined;
}
