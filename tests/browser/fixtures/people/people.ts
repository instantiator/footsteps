import { readFileSync } from "node:fs";

/** A photo of people for the fake camera to show, and how many people a model should find in it. */
export interface PeoplePhoto {
  /** The photo's file, in this folder, and its name for `setImage("photo:<name>")`. */
  name: string;
  /** The people in the foreground; a model may also find people further back. */
  people: number;
  /** What the photo tests. */
  scenario: string;
  /** The photographer, as credited on Wikimedia Commons. */
  artist: string;
  /** Where the photo came from. All are CC0 (public domain dedication), via Unsplash. */
  source: string;
}

/** Photos that test single players, groups, poses, backgrounds and lighting. Downloaded at 1280px wide. */
export const PEOPLE_PHOTOS: PeoplePhoto[] = [
  {
    name: "jumping-arms-up",
    people: 1,
    scenario: "one person facing the camera, mid-jump, arms up (greyscale)",
    artist: "Andreas Rønningen (andozo)",
    source: "https://commons.wikimedia.org/wiki/File:Jumping_high_over_cloudy_mountains_(Unsplash_5d2ETacuSgw).jpg",
  },
  {
    name: "jumping-side-on",
    people: 1,
    scenario: "one person side-on, mid-air",
    artist: "Tommaso Fornoni (tommytop)",
    source: "https://commons.wikimedia.org/wiki/File:Jump!_(Unsplash).jpg",
  },
  {
    name: "two-facing",
    people: 2,
    scenario: "two people facing the camera, full length",
    artist: "Christopher Campbell (chrisjoelcampbell)",
    source: "https://commons.wikimedia.org/wiki/File:Couple_in_Paradise._(Unsplash).jpg",
  },
  {
    name: "three-friends",
    people: 3,
    scenario: "three people side by side, touching",
    artist: "Priscilla Du Preez (artographybyp)",
    source: "https://commons.wikimedia.org/wiki/File:Three_friends_by_train_tracks_(Unsplash).jpg",
  },
  {
    name: "two-from-behind",
    people: 2,
    scenario: "two people from behind, holding hands",
    artist: "Artsy Vibes (artsyvibes)",
    source: "https://commons.wikimedia.org/wiki/File:Love_session_(Unsplash).jpg",
  },
  {
    name: "busy-street",
    people: 2,
    scenario: "two people walking towards the camera, with a busy background and small people behind",
    artist: "Tim Gouw (punttim)",
    source: "https://commons.wikimedia.org/wiki/File:Coney_Island_couple_(Unsplash).jpg",
  },
  {
    name: "backlit-three",
    people: 3,
    scenario: "three people backlit by a sunset, as silhouettes, arms up",
    artist: "Levi Guzman (homeschool)",
    source: "https://commons.wikimedia.org/wiki/File:Orange_sunset_celebration_(Unsplash).jpg",
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
