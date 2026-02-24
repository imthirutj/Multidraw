export const WORD_LIST: string[] = [
    // Animals
    'elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo', 'octopus', 'butterfly', 'crocodile',
    'flamingo', 'cheetah', 'gorilla', 'hedgehog', 'jellyfish', 'koala', 'lobster', 'peacock',
    'rhinoceros', 'scorpion', 'toucan', 'walrus', 'zebra', 'parrot', 'squirrel', 'raccoon',
    // Food
    'pizza', 'hamburger', 'spaghetti', 'sushi', 'taco', 'pancake', 'donut', 'cupcake',
    'watermelon', 'pineapple', 'strawberry', 'avocado', 'broccoli', 'popcorn', 'chocolate',
    'sandwich', 'ice cream', 'hot dog', 'pretzel', 'waffle',
    // Objects
    'umbrella', 'telescope', 'microphone', 'calculator', 'backpack', 'lantern', 'compass',
    'binoculars', 'anchor', 'trophy', 'crown', 'diamond', 'rocket', 'submarine', 'helicopter',
    'lighthouse', 'snowflake', 'rainbow', 'volcano', 'tornado',
    // Actions
    'swimming', 'dancing', 'flying', 'sleeping', 'climbing', 'jumping', 'fishing', 'bowling',
    'surfing', 'skiing', 'painting', 'cooking', 'gardening', 'reading', 'cycling',
    // Places
    'castle', 'pyramid', 'igloo', 'treehouse', 'windmill', 'stadium', 'aquarium', 'museum',
    // Fantasy
    'ghost', 'robot', 'wizard', 'mermaid', 'dragon', 'unicorn', 'superhero', 'ninja',
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
