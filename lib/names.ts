// A made-up name for a viewer without an account, like "Curious Heron 17": the same for the same browser every time,
// so a viewer's comments go under one name, and nobody can pick a name like "Meko" or "Admin".
const ADJECTIVES = [
  "Curious", "Quiet", "Bright", "Brave", "Calm", "Clever", "Gentle", "Keen", "Lucky", "Merry", "Nimble", "Patient",
  "Swift", "Wise", "Witty", "Bold", "Cheerful", "Eager", "Friendly", "Honest", "Jolly", "Kind", "Lively", "Mellow",
  "Noble", "Playful", "Sunny", "Thoughtful", "Vivid", "Steady",
];
const ANIMALS = [
  "Heron", "Otter", "Fox", "Owl", "Lynx", "Panda", "Koala", "Badger", "Beaver", "Dolphin", "Falcon", "Gecko",
  "Hedgehog", "Ibis", "Jaguar", "Kiwi", "Lemur", "Marten", "Narwhal", "Ocelot", "Puffin", "Quokka", "Raven", "Seal",
  "Tapir", "Toucan", "Vole", "Walrus", "Yak", "Zebra",
];

// FNV-1a, so the name needs no crypto and is the same in the browser and on the server.
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return value;
}

export function viewerName(viewerId: string): string {
  const value = hash(viewerId);
  return `${ADJECTIVES[value % ADJECTIVES.length]} ${ANIMALS[Math.floor(value / ADJECTIVES.length) % ANIMALS.length]} ${10 + (Math.floor(value / 900) % 90)}`;
}
