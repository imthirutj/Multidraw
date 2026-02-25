export const WORD_LIST: string[] = [
    // Animals
    'elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo', 'octopus', 'butterfly', 'crocodile',
    'flamingo', 'cheetah', 'gorilla', 'hedgehog', 'jellyfish', 'koala', 'lobster', 'peacock',
    'rhinoceros', 'scorpion', 'toucan', 'walrus', 'zebra', 'parrot', 'squirrel', 'raccoon',
    'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer', 'rabbit', 'frog', 'toad', 'snake', 'lizard',
    'turtle', 'shark', 'whale', 'seal', 'crab', 'bat', 'owl', 'eagle', 'hawk', 'pigeon', 'ostrich',
    'horse', 'cow', 'pig', 'sheep', 'goat', 'chicken', 'duck', 'goose', 'turkey', 'mouse', 'rat',
    'beaver', 'skunk', 'platypus', 'hippopotamus', 'sloth', 'anteater', 'armadillo', 'camel', 'llama',
    'alpaca', 'wombat', 'lemur', 'monkey', 'chimpanzee', 'orangutan', 'baboon', 'snail', 'worm', 'spider',

    // Food
    'pizza', 'hamburger', 'spaghetti', 'sushi', 'taco', 'pancake', 'donut', 'cupcake',
    'watermelon', 'pineapple', 'strawberry', 'avocado', 'broccoli', 'popcorn', 'chocolate',
    'sandwich', 'ice cream', 'hot dog', 'pretzel', 'waffle', 'apple', 'banana', 'orange',
    'grape', 'lemon', 'lime', 'cherry', 'peach', 'pear', 'plum', 'mango', 'kiwi', 'coconut',
    'pumpkin', 'carrot', 'potato', 'tomato', 'onion', 'garlic', 'pepper', 'mushroom', 'corn',
    'peas', 'beans', 'lettuce', 'cabbage', 'spinach', 'cheese', 'bread', 'cake', 'cookie',
    'pie', 'candy', 'bacon', 'sausage', 'steak', 'chicken', 'fish', 'shrimp', 'pudding', 'soup',

    // Objects
    'umbrella', 'telescope', 'microphone', 'calculator', 'backpack', 'lantern', 'compass',
    'binoculars', 'anchor', 'trophy', 'crown', 'diamond', 'rocket', 'submarine', 'helicopter',
    'lighthouse', 'snowflake', 'rainbow', 'volcano', 'tornado', 'chair', 'table', 'bed', 'sofa',
    'lamp', 'television', 'computer', 'keyboard', 'mouse', 'phone', 'clock', 'watch', 'camera',
    'book', 'notebook', 'pen', 'pencil', 'eraser', 'scissors', 'glue', 'tape', 'paper', 'ruler',
    'globe', 'map', 'key', 'lock', 'door', 'window', 'wall', 'roof', 'floor', 'stairs', 'ladder',
    'bridge', 'fence', 'gate', 'road', 'street', 'path', 'trail', 'suitcase', 'glasses', 'mirror',

    // Nature / Environment
    'mountain', 'hill', 'valley', 'river', 'lake', 'ocean', 'sea', 'beach', 'island', 'forest',
    'jungle', 'desert', 'cave', 'star', 'moon', 'sun', 'cloud', 'rain', 'snow', 'wind', 'storm',
    'lightning', 'thunder', 'tree', 'flower', 'grass', 'leaf', 'rock', 'sand', 'dirt', 'mud',

    // Actions
    'swimming', 'dancing', 'flying', 'sleeping', 'climbing', 'jumping', 'fishing', 'bowling',
    'surfing', 'skiing', 'painting', 'cooking', 'gardening', 'reading', 'cycling', 'running',
    'walking', 'crawling', 'singing', 'playing', 'writing', 'drawing', 'eating', 'drinking',
    'laughing', 'crying', 'smiling', 'frowning', 'shouting', 'whispering', 'listening', 'watching',

    // Places
    'castle', 'pyramid', 'igloo', 'treehouse', 'windmill', 'stadium', 'aquarium', 'museum',
    'school', 'hospital', 'library', 'bank', 'police station', 'fire station', 'post office',
    'restaurant', 'cafe', 'bakery', 'supermarket', 'mall', 'cinema', 'theater', 'park', 'playground',
    'zoo', 'farm', 'factory', 'airport', 'train station', 'bus station', 'gas station', 'hotel',

    // Fantasy
    'ghost', 'robot', 'wizard', 'mermaid', 'dragon', 'unicorn', 'superhero', 'ninja', 'zombie',
    'vampire', 'werewolf', 'alien', 'monster', 'fairy', 'elf', 'goblin', 'troll', 'witch', 'king',
    'queen', 'prince', 'princess', 'knight', 'pirate', 'cyclops', 'centaur', 'pegasus', 'phoenix',

    // Vehicles
    'car', 'bus', 'truck', 'van', 'taxi', 'police car', 'ambulance', 'fire engine', 'motorcycle',
    'bicycle', 'scooter', 'skateboard', 'rollerblades', 'train', 'subway', 'tram', 'airplane',
    'jet', 'glider', 'hot air balloon', 'blimp', 'boat', 'ship', 'sailboat', 'yacht', 'canoe', 'kayak',

    // Body Parts & Clothing
    'head', 'hair', 'face', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'tongue', 'lip', 'neck',
    'shoulder', 'arm', 'elbow', 'wrist', 'hand', 'finger', 'thumb', 'chest', 'stomach', 'back',
    'leg', 'knee', 'ankle', 'foot', 'toe', 'heel', 'shirt', 'pants', 'jeans', 'shorts', 'dress',
    'skirt', 'sweater', 'jacket', 'coat', 'sock', 'shoe', 'boot', 'sandal', 'slipper', 'hat',
    'cap', 'glove', 'mitten', 'scarf', 'tie', 'belt', 'ring', 'necklace', 'bracelet', 'earring'
];

export function getRandomWord(): string {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

export function getWordHint(word: string): string {
    return word.split('').map(c => (c === ' ' ? ' ' : '_')).join(' ');
}

export function getRevealedHint(word: string, revealCount: number): string {
    const letters = word.replace(/ /g, '').split('');
    const indices: number[] = [];

    while (indices.length < revealCount && indices.length < letters.length) {
        const i = Math.floor(Math.random() * letters.length);
        if (!indices.includes(i)) indices.push(i);
    }

    let letterIdx = 0;
    return word
        .split('')
        .map(c => {
            if (c === ' ') return ' ';
            const revealed = indices.includes(letterIdx++);
            return revealed ? c : '_';
        })
        .join(' ');
}

export const TRUTH_LIST: string[] = [
    "What is your biggest fear in life?",
    "If you could be invisible for a day, what's the first thing you would do?",
    "What is the most embarrassing thing you've ever done?",
    "Have you ever lied to get out of a bad date or hangout?",
    "What's the worst trouble you got into as a kid?",
    "If you had to trade lives with someone in this room, who would it be?",
    "What's a secret you've never told anyone here?",
    "What is your most bizarre habit?",
    "Who was your first celebrity crush?",
    "What is the most awkward text you've ever accidentally sent?",
    "Have you ever eaten food that fell on the floor?",
    "What's the weirdest dream you've ever had?",
    "If you could perfectly pull off any crime, what would it be?",
    "What is your most embarrassing guilty pleasure?",
    "Have you ever accidentally eavesdropped on a juicy conversation?"
];

export const DARE_LIST: string[] = [
    "Do 10 pushups right now.",
    "Show the last photo you took on your phone to the camera.",
    "Speak in a weird accent until your next turn.",
    "Try to lick your elbow.",
    "Let someone else in the room (or the host) give you a silly nickname you must use.",
    "Sing the chorus of your favorite song out loud.",
    "Do your best impression of another player in the room.",
    "Balance a spoon (or object) on your nose for 10 seconds.",
    "Type a message using only your nose in the chat.",
    "Close your eyes and try to guess what someone is holding up to the camera.",
    "Do a dramatic reading of the last text message you received.",
    "Dance with no music for 15 seconds.",
    "Make up a poem about the person who went before you.",
    "Draw a funny face on your hand or arm.",
    "Act like a monkey until someone can guess what you are doing (without saying it)."
];

export function getRandomTruth(): string {
    return TRUTH_LIST[Math.floor(Math.random() * TRUTH_LIST.length)];
}

export function getRandomDare(): string {
    return DARE_LIST[Math.floor(Math.random() * DARE_LIST.length)];
}
