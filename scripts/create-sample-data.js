/**
 * Script to create sample data for ChordsNote app screenshots
 * This populates the Zustand store with realistic data
 */

// Sample band data
const sampleBands = [
  {
    id: 'band-1',
    name: 'The Rolling Stones Cover Band',
    color: 0, // Red
    description: 'Suoniamo i classici degli Stones dagli anni 60 ad oggi',
    kind: 'band',
    members: [
      { id: 'm1', name: 'Pierlu', color: 0, role: 'owner' },
      { id: 'm2', name: 'Giulia', color: 1, role: 'editor' },
      { id: 'm3', name: 'Marco', color: 2, role: 'viewer' }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5   // 5 days ago
  },
  {
    id: 'band-2',
    name: 'Jazz quartet Milano',
    color: 2, // Blue
    description: 'Repertorio jazz tradizionale e bebop',
    kind: 'band',
    members: [
      { id: 'm4', name: 'Alex', color: 0, role: 'owner' },
      { id: 'm5', name: 'Sara', color: 1, role: 'editor' }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15, // 15 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2   // 2 days ago
  }
];

// Sample personal catalogs
const samplePersonalCatalogs = [
  {
    id: 'personal-1',
    name: 'Il mio repertorio',
    color: 3, // Purple
    description: 'Canzoni che suono da solo o con amici',
    kind: 'personal',
    members: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60, // 60 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7    // 7 days ago
  }
];

// Sample songs for bands
const sampleBandSongs = [
  {
    id: 'song-1',
    title: '(I Can't Get No) Satisfaction',
    artist: 'The Rolling Stones',
    key: 'E',
    catalogId: 'band-1',
    favorite: true,
    draft: false,
    sections: [
      {
        id: 's1',
        kind: 'verse',
        lines: [
          { id: 'l1', text: 'I can't get no satisfaction', chords: [{ id: 'c1', pos: 0, chord: 'E' }, { id: 'c2', pos: 8, chord: 'B' }] },
          { id: 'l2', text: 'I can't get no girl reaction', chords: [{ id: 'c3', pos: 0, chord: 'E' }, { id: 'c4', pos: 6, chord: 'A' }] }
        ]
      },
      {
        id: 's2',
        kind: 'chorus',
        lines: [
          { id: 'l3', text: 'Cause I try and I try and I try and I try', chords: [{ id: 'c5', pos: 0, chord: 'E' }, { id: 'c6', pos: 4, chord: 'B' }, { id: 'c7', pos: 8, chord: 'A' }] },
          { id: 'l4', text: 'I can get no, no, no, no, no, no', chords: [{ id: 'c8', pos: 0, chord: 'E' }, { id: 'c9', pos: 6, chord: 'B' }] }
        ]
      }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 10
  },
  {
    id: 'song-2',
    title: 'Jumpin\' Jack Flash',
    artist: 'The Rolling Stones',
    key: 'G',
    catalogId: 'band-1',
    favorite: false,
    draft: false,
    sections: [
      {
        id: 's3',
        kind: 'verse',
        lines: [
          { id: 'l5', text: 'I was born in a cross-fire hurricane', chords: [{ id: 'c10', pos: 0, chord: 'G' }, { id: 'c11', pos: 6, chord: 'C' }] },
          { id: 'l6', text: 'And I howled at my ma in the driving rain', chords: [{ id: 'c12', pos: 0, chord: 'D' }, { id: 'c13', pos: 8, chord: 'G' }] }
        ]
      }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 18,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 8
  }
];

// Sample songs for personal catalog
const samplePersonalSongs = [
  {
    id: 'song-3',
    title: 'Yesterday',
    artist: 'The Beatles',
    key: 'F',
    catalogId: 'personal-1',
    favorite: true,
    draft: false,
    sections: [
      {
        id: 's4',
        kind: 'verse',
        lines: [
          { id: 'l7', text: 'Yesterday, all my troubles seemed so far away', chords: [{ id: 'c14', pos: 0, chord: 'F' }, { id: 'c15', pos: 10, chord: 'Em' }] },
          { id: 'l8', text: 'Now it looks as though they\'re here to stay', chords: [{ id: 'c16', pos: 0, chord: 'F' }, { id: 'c17', pos: 8, chord: 'Dm' }] }
        ]
      }
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5
  }
];

// Sample setlist
const sampleSetlist = {
  id: 'setlist-1',
  name: 'Serata al Blu Note',
  catalogId: 'band-1',
  items: [
    { id: 'item1', type: 'song', songId: 'song-1' },
    { id: 'item2', type: 'song', songId: 'song-2' }
  ],
  createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 1
};

// Sample account
const sampleAccount = {
  uid: 'user-123',
  email: 'pierlu@example.com',
  name: 'Pierlu Romano',
  photoURL: null,
  createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
  updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7
};

// Sample settings
const sampleSettings = {
  fontScale: 1.0,
  showChords: true,
  keepAwake: false,
  notation: 'anglo',
  userName: 'Pierlu Romano'
};

// Combine all data
const sampleData = {
  catalogs: [...sampleBands, ...samplePersonalCatalogs],
  songs: [...sampleBandSongs, ...samplePersonalSongs],
  setlists: [sampleSetlist],
  settings: sampleSettings,
  hydrated: true,
  ownerUid: sampleAccount.uid
};

console.log('Sample data created:', JSON.stringify(sampleData, null, 2));