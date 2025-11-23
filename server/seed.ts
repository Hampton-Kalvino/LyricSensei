import { db } from "./db";
import { songs, lyrics } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Check if songs already exist
  const existingSongs = await db.select().from(songs);
  if (existingSongs.length > 0) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  // Insert sample songs
  const [song1, song2] = await db.insert(songs).values([
    {
      id: "song-1",
      title: "Despacito",
      artist: "Luis Fonsi ft. Daddy Yankee",
      album: "Vida",
      duration: 228,
      albumArt: "https://upload.wikimedia.org/wikipedia/en/c/c8/Luis_Fonsi_Feat._Daddy_Yankee_-_Despacito_%28Official_Single_Cover%29.png",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    },
    {
      id: "song-2",
      title: "Shape of You",
      artist: "Ed Sheeran",
      album: "÷ (Divide)",
      duration: 233,
      albumArt: "https://upload.wikimedia.org/wikipedia/en/b/b4/Ed_Sheeran_Shape_of_You.png",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    },
  ]).returning();

  // Insert lyrics for Despacito
  await db.insert(lyrics).values([
    { songId: song1.id, startTime: 0, endTime: 4, text: "Sí, sabes que ya llevo un rato mirándote" },
    { songId: song1.id, startTime: 4, endTime: 8, text: "Tengo que bailar contigo hoy" },
    { songId: song1.id, startTime: 8, endTime: 12, text: "Vi que tu mirada ya estaba llamándome" },
    { songId: song1.id, startTime: 12, endTime: 16, text: "Muéstrame el camino que yo voy" },
    { songId: song1.id, startTime: 16, endTime: 20, text: "Tú, tú eres el imán y yo soy el metal" },
    { songId: song1.id, startTime: 20, endTime: 24, text: "Me voy acercando y voy armando el plan" },
    { songId: song1.id, startTime: 24, endTime: 28, text: "Solo con pensarlo se acelera el pulso" },
    { songId: song1.id, startTime: 32, endTime: 36, text: "Despacito" },
    { songId: song1.id, startTime: 36, endTime: 40, text: "Quiero respirar tu cuello despacito" },
    { songId: song1.id, startTime: 40, endTime: 44, text: "Deja que te diga cosas al oído" },
  ]);

  // Insert lyrics for Shape of You
  await db.insert(lyrics).values([
    { songId: song2.id, startTime: 0, endTime: 4, text: "The club isn't the best place to find a lover" },
    { songId: song2.id, startTime: 4, endTime: 8, text: "So the bar is where I go" },
    { songId: song2.id, startTime: 8, endTime: 12, text: "Me and my friends at the table doing shots" },
    { songId: song2.id, startTime: 12, endTime: 16, text: "Drinking fast and then we talk slow" },
    { songId: song2.id, startTime: 16, endTime: 20, text: "Come over and start up a conversation with just me" },
    { songId: song2.id, startTime: 20, endTime: 24, text: "And trust me I'll give it a chance now" },
    { songId: song2.id, startTime: 24, endTime: 28, text: "Take my hand, stop, put Van the Man on the jukebox" },
    { songId: song2.id, startTime: 28, endTime: 32, text: "And then we start to dance" },
    { songId: song2.id, startTime: 32, endTime: 36, text: "I'm in love with the shape of you" },
    { songId: song2.id, startTime: 36, endTime: 40, text: "We push and pull like a magnet do" },
  ]);

  console.log("Database seeded successfully!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
