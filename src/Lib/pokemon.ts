import globalState from "../Base/state.js";
import type { Pokemon, PokemonBulk } from "./types.js";

const KEYS = {
  pokemon: "pokemonList",
  data: "pokemonData",
};

export async function getPokemonData(pokemonName: string): Promise<Pokemon> {
  let pokemon: Pokemon[] = globalState.getState(KEYS.data) ?? [];
  if (pokemon.length == 0) {
    await fetchAllPokemon();
  }

  let pkmnData = pokemon.find((p) => p.name == pokemonName);
  if (pkmnData) return pkmnData;

  if (pokemonName.toLowerCase() == "meowstic") {
    pkmnData = {
      id: 678,
      name: "meowstic",
      types: [],
      sprites: { front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/678.png" } as any,
      height: -1,
      weight: -1,
      stats: [],
    };
    return pkmnData;
  } else {
    console.log(`[Pokemon] Fetching pokemon data: ${pokemonName}.`);
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    if (!response.ok) throw new Error(`Pokémon ${pokemonName} not found`);
    pkmnData = (await response.json()) as Pokemon;
  }

  pokemon.push(pkmnData!);
  globalState.setState(KEYS.data, pokemon);

  return pkmnData!;
}

export async function getPokemonSprite(pokemonName: string): Promise<string | null> {
  let pokemon = await getPokemonData(pokemonName);

  return pokemon.sprites.front_default;
}

export async function fetchAllPokemon(): Promise<PokemonBulk[]> {
  let pokemon: PokemonBulk[] = globalState.getState(KEYS.pokemon) ?? [];
  if (pokemon.length != 0) return pokemon;

  console.log("[Pokemon] Fetching pokemon.");
  let response;
  try {
    response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=100000&offset=0");
  } catch (error) {
    console.error(error);
    return [];
  }
  pokemon = (await response.json()).results;
  globalState.setState(KEYS.pokemon, pokemon);

  return pokemon;
}

export async function pokemonNamesAsChoices(): Promise<{ name: string; value: string }[]> {
  const list = await fetchAllPokemon();
  return list.map((p) => ({ name: p.name, value: p.name }));
}

export async function getEvolutionChain(pokemonName: string): Promise<string[]> {
  const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonName}`);
  const speciesData: any = await speciesRes.json();

  const evoUrl = speciesData.evolution_chain.url;
  const evoRes = await fetch(evoUrl);
  const evoData: any = await evoRes.json();

  const evolutions: string[] = [];
  let current = evoData.chain;

  // Traverse chain
  while (current) {
    evolutions.push(current.species.name);
    current = current.evolves_to?.[0]; // assuming linear evolution
  }

  return evolutions;
}

export async function getNextEvolution(pokemonName: string): Promise<string | undefined> {
  const evolutions = await getEvolutionChain(pokemonName);

  const index = evolutions.indexOf(pokemonName);

  if (index < evolutions.length - 1) return evolutions[index + 1];
}
