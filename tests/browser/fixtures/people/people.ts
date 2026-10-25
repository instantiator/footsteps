import { readFileSync } from "node:fs";

/** A photo of people for the fake camera to show, and how many people a model should find in it. */
export interface PeoplePhoto {
  /** The photo's file, in this folder, and its name for `setImage("photo:<name>")`. */
  name: string;
  /** The people in the foreground; a model may also find people further back. */
  people: number;
  /** Whether the foreground people are in shot down to their feet, so their feet can be expected. */
  fullLength: boolean;
  /** What the photo tests. */
  scenario: string;
  /** The photographer, as credited on Wikimedia Commons. */
  artist: string;
  /** Where the photo came from. Each is CC0 (via Unsplash) or a US government photo in the public domain. */
  source: string;
}

/** Photos that test single players, groups, children, poses, rooms, backgrounds and lighting. 960px wide. */
export const PEOPLE_PHOTOS: PeoplePhoto[] = [
  {
    name: "jumping-arms-up",
    fullLength: true,
    people: 1,
    scenario: "one person facing the camera, mid-jump, arms up (greyscale)",
    artist: "Andreas Rønningen (andozo)",
    source: "https://commons.wikimedia.org/wiki/File:Jumping_high_over_cloudy_mountains_(Unsplash_5d2ETacuSgw).jpg",
  },
  {
    name: "jumping-side-on",
    fullLength: true,
    people: 1,
    scenario: "one person side-on, mid-air",
    artist: "Tommaso Fornoni (tommytop)",
    source: "https://commons.wikimedia.org/wiki/File:Jump!_(Unsplash).jpg",
  },
  {
    name: "two-facing",
    fullLength: true,
    people: 2,
    scenario: "two people facing the camera, full length",
    artist: "Christopher Campbell (chrisjoelcampbell)",
    source: "https://commons.wikimedia.org/wiki/File:Couple_in_Paradise._(Unsplash).jpg",
  },
  {
    name: "three-friends",
    fullLength: false,
    people: 3,
    scenario: "three people side by side, touching, cut off at the thighs (no legs or feet)",
    artist: "Priscilla Du Preez (artographybyp)",
    source: "https://commons.wikimedia.org/wiki/File:Three_friends_by_train_tracks_(Unsplash).jpg",
  },
  {
    name: "two-from-behind",
    fullLength: true,
    people: 2,
    scenario: "two people from behind, holding hands",
    artist: "Artsy Vibes (artsyvibes)",
    source: "https://commons.wikimedia.org/wiki/File:Love_session_(Unsplash).jpg",
  },
  {
    name: "busy-street",
    fullLength: true,
    people: 2,
    scenario: "two people walking towards the camera, with a busy background and small people behind",
    artist: "Tim Gouw (punttim)",
    source: "https://commons.wikimedia.org/wiki/File:Coney_Island_couple_(Unsplash).jpg",
  },
  {
    name: "backlit-three",
    fullLength: false,
    people: 3,
    scenario: "three people backlit by a sunset, as silhouettes, arms up",
    artist: "Levi Guzman (homeschool)",
    source: "https://commons.wikimedia.org/wiki/File:Orange_sunset_celebration_(Unsplash).jpg",
  },
  {
    name: "indoor-skateboarder-couch",
    fullLength: true,
    people: 1,
    scenario: "indoors: one person mid-trick in front of a couch, busy graffiti walls",
    artist: "Jeremy Thomas jeremythomasphoto",
    source: "https://commons.wikimedia.org/wiki/File:Skateboarder_in_front_of_couch_(Unsplash).jpg",
  },
  {
    name: "indoor-artistic-room",
    fullLength: true,
    people: 1,
    scenario: "indoors: one person small in a furnished room, against windows",
    artist: "Bench Accounting benchaccounting",
    source: "https://commons.wikimedia.org/wiki/File:Woman_in_an_artistic_room_(Unsplash).jpg",
  },
  {
    name: "indoor-kitchen-motion-blur",
    fullLength: false,
    people: 1,
    scenario: "indoors: one person spinning, motion-blurred, in a dark kitchen",
    artist: "Christopher Johnson w00keybot",
    source: "https://commons.wikimedia.org/wiki/File:Man_in_kitchen_in_motion_(Unsplash).jpg",
  },
  {
    name: "indoor-dance-studio",
    fullLength: true,
    people: 1,
    scenario: "indoors: one person dancing in a studio, arms raised",
    artist: "US Marine Corps",
    source: "https://commons.wikimedia.org/wiki/File:USMC-100303-M-4913M-137.jpg",
  },
  {
    name: "indoor-aerobathon",
    fullLength: true,
    people: 2,
    scenario: "indoors: two people dancing in a gym, more at the edges",
    artist: "Pvt. Kourtney Grimes",
    source: "https://commons.wikimedia.org/wiki/File:Aerobathon_gets_blood_pumping_140312-Z-KY529-109.jpg",
  },
  {
    name: "group-zumba-class",
    fullLength: true,
    people: 6,
    scenario: "indoors: a zumba class of six, kicking, overlapping",
    artist: "Brittany Carlson (USAG Stuttgart)",
    source: "https://commons.wikimedia.org/wiki/File:US_Army_52862_Zumba_adds_Latin_dance_to_fitness_routine.jpg",
  },
  {
    name: "group-step-aerobics",
    fullLength: true,
    people: 4,
    scenario: "indoors: four people at step aerobics in a dim gym",
    artist: "Spc. Crystal Abbott /10th PCH",
    source: "https://commons.wikimedia.org/wiki/File:US_Army_51673_aerobathon.jpg",
  },
  {
    name: "group-navy-fitness",
    fullLength: true,
    people: 2,
    scenario: "indoors: two people dancing, a class behind them",
    artist: "U.S. Navy photo by Mass Communication Specialist 3rd Class Billy Ho",
    source:
      "https://commons.wikimedia.org/wiki/File:US_Navy_110621-N-QL471-152_Aviation_Maintenance_Administrationman_1st_Class_Brandi_Heath,_left,_and_Aviation_Ordnanceman_2nd_Class_Tonia_Devine_par.jpg",
  },
  {
    name: "group-rugby-team",
    fullLength: true,
    people: 10,
    scenario: "about ten players standing and walking, overlapping",
    artist: "Quino Al quinoal",
    source: "https://commons.wikimedia.org/wiki/File:Rugby_(Unsplash).jpg",
  },
  {
    name: "group-rugby-scrum",
    fullLength: true,
    people: 10,
    scenario: "about ten players bound in a scrum, heavily overlapping",
    artist: "Olga Guryanova designer4u",
    source: "https://commons.wikimedia.org/wiki/File:Moscow_Rugby_team_(Unsplash).jpg",
  },
  {
    name: "group-zumba-youths",
    fullLength: false,
    people: 2,
    scenario: "indoors: two people close up, arms out, cut off at the thighs, more behind",
    artist: "Sgt. Jerry Boffen",
    source: "https://commons.wikimedia.org/wiki/File:Zumba_unites_multiethnic_youths_in_Novo_Brdo_DVIDS335358.jpg",
  },
  {
    name: "child-girl-dress",
    fullLength: true,
    people: 1,
    scenario: "a small child in a dress, from behind",
    artist: "Caroline Hernandez carolinehdz",
    source: "https://commons.wikimedia.org/wiki/File:Little_Girl_on_the_Road_(Unsplash).jpg",
  },
  {
    name: "child-backyard",
    fullLength: true,
    people: 2,
    scenario: "two children, one jumping, in a back yard",
    artist: "Brandon Morgan littleppl85",
    source: "https://commons.wikimedia.org/wiki/File:Children_backyard_swimming_(Unsplash_XtOKVEyHP2s).jpg",
  },
  {
    name: "child-skate-park",
    fullLength: true,
    people: 1,
    scenario: "a child standing on a wall, against the sky",
    artist: "Clark Young clark1",
    source: "https://commons.wikimedia.org/wiki/File:Kid_At_The_Skate_Park_(Unsplash).jpg",
  },
  {
    name: "child-gym-jumping",
    fullLength: true,
    people: 2,
    scenario: "indoors: two people jumping in a sports hall, more behind (dark trousers, a long skirt)",
    artist: "Rochelle Smolinski",
    source:
      "https://commons.wikimedia.org/wiki/File:Zumba_instructor_Honey_Cushman_and_equal_opportunity_advisor_Gunnery_Sgt._Curtis_Bradley_yell_encouragement_toward_the_end_of_the_special_Hispanic_Heritage_Zumba_class,_on_Marine_Corps_Base_Hawaii,_Hawaii,_Oct_121004-M-NM356-053.jpg",
  },
  {
    name: "active-skateboard-trick",
    fullLength: true,
    people: 1,
    scenario: "one person mid-air on a skateboard, patterned trousers",
    artist: "Andrea Junqueira musiua",
    source: "https://commons.wikimedia.org/wiki/File:Person_doing_skateboard_trick_(Unsplash).jpg",
  },
  {
    name: "active-runner-forest",
    fullLength: true,
    people: 1,
    scenario: "one person running on a path",
    artist: "Jenny Hill jennyhill",
    source: "https://commons.wikimedia.org/wiki/File:Runner_in_Stainburn_Forest_(Unsplash).jpg",
  },
  {
    name: "active-sprint-start",
    fullLength: true,
    people: 1,
    scenario: "one person crouched at a sprint start",
    artist: "William Stitt willpower",
    source: "https://commons.wikimedia.org/wiki/File:The_Runner_(Unsplash).jpg",
  },
];

/** Each photo as a data URL, by name, for the fake camera. */
export const peoplePhotoUrls = (): Record<string, string> =>
  Object.fromEntries(
    PEOPLE_PHOTOS.map(({ name }) => [
      name,
      `data:image/jpeg;base64,${readFileSync(new URL(`./${name}.jpg`, import.meta.url)).toString("base64")}`,
    ]),
  );
