import { createCanvas, loadImage, CanvasRenderingContext2D } from "canvas";
import { getPokemonSprite } from "./pokemon.js";
import type { GroupedEncounter } from "./types.js";

// registerFont('./src/assets/PressStart2p-Regular.ttf', { family: 'PressStart2P' });

export async function generateBoxImageFromGroups(groups: GroupedEncounter[]): Promise<Buffer> {
  const spriteSize = 64;
  const scale = 4;
  const spriteScale = 2;
  const spacing = 10;
  const cols = 4;

  const rows = Math.ceil(groups.length / cols);

  const boxSize = spriteSize * 2.8;
  const canvasWidth = (boxSize * cols + spacing * (cols - 1)) * scale;
  const canvasHeight = (boxSize + spacing) * rows * scale;

  const actualSpriteSize = spriteSize * scale * spriteScale;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0B1A2E";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const radius = boxSize;

  const globalRotationDegrees = 150;
  const globalRotationRadians = globalRotationDegrees * (Math.PI / 180);

  ctx.font = `bold ${8 * scale * spriteScale}px 'Courier New'`;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    const offsetX = (boxSize + spacing) * (i % cols) * scale;
    const offsetY = (boxSize + spacing) * Math.floor(i / cols) * scale;

    const centerX = (boxSize * scale) / 2 + offsetX;
    const centerY = (boxSize * scale) / 2 + offsetY;

    drawPokeball(ctx, { topLeft: [offsetX, offsetY], bottomRight: [offsetX + boxSize * scale, offsetY + boxSize * scale] }, (radius * scale * 4) / 5);

    const pokemonCount = group.encounters.length;
    ctx.fillText("#", centerX, centerY);

    if (pokemonCount === 1) {
      const encounter = group.encounters[0];
      const { pokemon } = encounter;

      const spriteUrl = await getPokemonSprite(pokemon);
      const sprite = await loadImage(spriteUrl!);

      const spriteX = centerX - actualSpriteSize / 2;
      const spriteY = centerY - actualSpriteSize / 2;

      ctx.drawImage(sprite, spriteX, spriteY, actualSpriteSize, actualSpriteSize);
    } else if (pokemonCount > 1) {
      const angleStep = (2 * Math.PI) / pokemonCount;
      const spritesToDraw: { sprite: any; x: number; y: number; width: number; height: number }[] = [];

      for (let j = 0; j < pokemonCount; j++) {
        const encounter = group.encounters[j];
        const { pokemon } = encounter;

        const spriteUrl = await getPokemonSprite(pokemon);
        const sprite = await loadImage(spriteUrl!);

        const angle = j * angleStep + globalRotationRadians;

        const spriteX = centerX + radius * Math.cos(angle) - actualSpriteSize / 2;
        const spriteY = centerY + radius * Math.sin(angle) - actualSpriteSize / 2;

        spritesToDraw.push({
          sprite,
          x: spriteX,
          y: spriteY,
          width: actualSpriteSize,
          height: actualSpriteSize,
        });
      }

      // Draw sprites in order so that lowest Y value is drawn last (on top)
      spritesToDraw.sort((a, b) => a.y - b.y);

      for (const spriteData of spritesToDraw) {
        ctx.drawImage(spriteData.sprite, spriteData.x, spriteData.y, spriteData.width, spriteData.height);
      }
    }
    // Measure actual text width
    const textMetrics = ctx.measureText(group.nickname);
    const textWidth = textMetrics.width;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(group.nickname, centerX - textWidth / 2, offsetY + boxSize * scale);
  }

  return canvas.toBuffer("image/png");
}

export async function singlePokemonGroup(group: GroupedEncounter): Promise<Buffer> {
  const boxSize = 64;
  const scale = 4;
  const radius = boxSize;

  const centerX = (boxSize * scale) / 2;
  const centerY = (boxSize * scale) / 2;

  const actualSpriteSize = boxSize * scale;

  const canvas = createCanvas(boxSize * scale, boxSize * scale);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0B1A2E";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPokeball(ctx, { topLeft: [0, 0], bottomRight: [boxSize * scale, boxSize * scale] }, (radius * scale * 4) / 5);

  const pokemonCount = group.encounters.length;
  ctx.fillText("#", centerX, centerY);

  if (pokemonCount === 1) {
    const encounter = group.encounters[0];
    const { pokemon } = encounter;

    const spriteUrl = await getPokemonSprite(pokemon);
    const sprite = await loadImage(spriteUrl!);

    const spriteX = centerX - actualSpriteSize / 2;
    const spriteY = centerY - actualSpriteSize / 2;

    ctx.drawImage(sprite, spriteX, spriteY, actualSpriteSize, actualSpriteSize);
  } else if (pokemonCount > 1) {
    const angleStep = (2 * Math.PI) / pokemonCount;
    const spritesToDraw: { sprite: any; x: number; y: number; width: number; height: number }[] = [];

    const globalRotationDegrees = 150;
    const globalRotationRadians = globalRotationDegrees * (Math.PI / 180);

    for (let j = 0; j < pokemonCount; j++) {
      const encounter = group.encounters[j];
      const { pokemon } = encounter;

      const spriteUrl = await getPokemonSprite(pokemon);
      const sprite = await loadImage(spriteUrl!);

      const angle = j * angleStep + globalRotationRadians;

      const spriteX = centerX + radius * Math.cos(angle) - actualSpriteSize / 2;
      const spriteY = centerY + radius * Math.sin(angle) - actualSpriteSize / 2;

      spritesToDraw.push({
        sprite,
        x: spriteX,
        y: spriteY,
        width: actualSpriteSize,
        height: actualSpriteSize,
      });
    }

    // Draw sprites in order so that lowest Y value is drawn last (on top)
    spritesToDraw.sort((a, b) => a.y - b.y);

    for (const spriteData of spritesToDraw) {
      ctx.drawImage(spriteData.sprite, spriteData.x, spriteData.y, spriteData.width, spriteData.height);
    }
  }
  ctx.font = `bold ${8 * scale}px 'Courier New'`;

  const textMetrics = ctx.measureText(group.nickname);
  const textWidth = textMetrics.width;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(group.nickname, centerX - textWidth / 2, boxSize * scale);

  return canvas.toBuffer("image/png");
}

/**
 * Helper to draw rounded rectangle
 */
function drawPokeball(
  ctx: CanvasRenderingContext2D,
  pos: { topLeft: [number, number]; bottomRight: [number, number] },
  size: number
) {
  const radius = size / 2;

  const bgBlue = "#0B1A2E";
  const blue = "#1E3A5F";

  const centerX = (pos.topLeft[0] + pos.bottomRight[0]) / 2;
  const centerY = (pos.topLeft[1] + pos.bottomRight[1]) / 2;

  const width = pos.bottomRight[0] - pos.topLeft[0];
  const height = pos.bottomRight[1] - pos.topLeft[1];

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = blue;
  ctx.fill();

  ctx.fillStyle = bgBlue;
  ctx.beginPath();
  ctx.rect(pos.topLeft[0], pos.topLeft[1] + (height * 9) / 20, width, (height * 1) / 10);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, (radius * 2) / 5, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = bgBlue;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, (radius * 1) / 5, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = blue;
  ctx.fill();
}
