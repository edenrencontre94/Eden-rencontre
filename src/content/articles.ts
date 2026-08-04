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
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find(a => a.slug === slug);
}
