import { jsPDF } from "jspdf";
import PptxGenJS from "pptxgenjs";
import type { Character } from "@/stores/movie-store";

async function blobToDataUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function addImageSafe(
  doc: jsPDF,
  url: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<boolean> {
  try {
    const dataUrl = url.startsWith("blob:") ? await blobToDataUrl(url) : url;
    doc.addImage(dataUrl, "PNG", x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

export async function generateEbook(
  title: string,
  characters: Character[],
  scenes: Character[],
  language: string,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addWrappedText = (text: string, fontSize: number, maxW: number) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxW);
    const textH = lines.length * (fontSize * 0.3528 + 1);
    checkPageBreak(textH);
    doc.text(lines, margin, y);
    y += textH + 3;
  };

  // Title page
  doc.setFontSize(24);
  doc.text("Movie eBook", pageW / 2, 40, { align: "center" });
  doc.setFontSize(14);
  doc.text(title || "Untitled Movie", pageW / 2, 50, { align: "center" });
  if (language) {
    doc.setFontSize(10);
    doc.text(`Language: ${language}`, pageW / 2, 60, { align: "center" });
  }
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageW / 2, 70, {
    align: "center",
  });
  y = 85;

  // Characters section
  if (characters.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(18);
    doc.text("Characters", margin, y);
    y += 12;

    for (const char of characters) {
      checkPageBreak(50);
      doc.setFontSize(13);
      doc.text(char.name || "Unnamed Character", margin, y);
      y += 7;

      if (char.imageUrl) {
        const imgW = 40;
        const imgH = 40;
        const added = await addImageSafe(doc, char.imageUrl, margin, y, imgW, imgH);
        if (added) {
          doc.setFontSize(9);
          addWrappedText(char.description || "No description", 9, contentW - imgW - 5);
          y = Math.max(y + imgH, y) + 3;
        } else {
          doc.setFontSize(9);
          addWrappedText(char.description || "No description", 9, contentW);
        }
      } else {
        doc.setFontSize(9);
        addWrappedText(char.description || "No description", 9, contentW);
      }
      y += 3;
    }
  }

  // Scenes section
  if (scenes.length > 0) {
    checkPageBreak(20);
    doc.setFontSize(18);
    doc.text("Scenes", margin, y);
    y += 12;

    for (const scene of scenes) {
      checkPageBreak(30);
      doc.setFontSize(14);
      doc.text(scene.name || "Unnamed Scene", margin, y);
      y += 8;

      if (scene.location) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Location: ${scene.location}`, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
      }

      if (scene.imageUrl) {
        const imgW = 50;
        const imgH = 38;
        checkPageBreak(imgH);
        const added = await addImageSafe(doc, scene.imageUrl, margin, y, imgW, imgH);
        if (added) {
          doc.setFontSize(9);
          addWrappedText(scene.description || "No description", 9, contentW - imgW - 5);
          y = Math.max(y + imgH, y) + 3;
        } else {
          doc.setFontSize(9);
          addWrappedText(scene.description || "No description", 9, contentW);
        }
      } else {
        doc.setFontSize(9);
        addWrappedText(scene.description || "No description", 9, contentW);
      }

      // Conversations / Script
      const conversations = scene.conversations || [];
      if (conversations.length > 0) {
        checkPageBreak(15);
        y += 2;
        doc.setFontSize(10);
        doc.text("Script:", margin, y);
        y += 6;

        for (const conv of conversations) {
          checkPageBreak(8);
          doc.setFontSize(9);
          const line = `${conv.person || "Character"}: "${conv.line}"`;
          addWrappedText(line, 9, contentW - 5);
        }
      }
      y += 5;
    }
  }

  return doc.output("blob");
}

async function blobToBase64(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generatePptx(
  title: string,
  characters: Character[],
  scenes: Character[],
): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const slideW = 13.33;
  const slideH = 7.5;
  const margin = 0.4;
  const gutter = 0.3;
  const splitX = slideW * 0.45;
  const leftW = splitX - margin - gutter / 2;
  const rightX = splitX + gutter / 2;
  const rightW = slideW - rightX - margin;
  const rightH = slideH - margin * 2;

  const fitImage = (dims: { w: number; h: number }, maxW: number, maxH: number) => {
    const aspect = dims.w / dims.h;
    let w: number, h: number;
    if (aspect > maxW / maxH) {
      w = maxW;
      h = maxW / aspect;
    } else {
      h = maxH;
      w = maxH * aspect;
    }
    return { w, h, x: rightX + (maxW - w) / 2, y: margin + (maxH - h) / 2 };
  };

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "FFFFFF" };
  titleSlide.addText("Movie Presentation", {
    x: 0, y: 1.5, w: "100%", h: 1,
    fontSize: 36, bold: true, align: "center", color: "000000",
  });
  titleSlide.addText(title || "Untitled Movie", {
    x: 0, y: 2.5, w: "100%", h: 0.6,
    fontSize: 20, align: "center", color: "555555",
  });
  titleSlide.addText(new Date().toLocaleDateString(), {
    x: 0, y: 3.3, w: "100%", h: 0.4,
    fontSize: 12, align: "center", color: "999999",
  });

  // Character slides
  for (const char of characters) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // Left column: text
    slide.addText(char.name || "Unnamed", {
      x: margin, y: 1.5, w: leftW, h: 0.5,
      fontSize: 22, bold: true, color: "000000", align: "left",
    });
    slide.addText("Character", {
      x: margin, y: 2.0, w: leftW, h: 0.3,
      fontSize: 10, color: "777777", align: "left",
    });
    slide.addText(char.description || "No description", {
      x: margin, y: 2.6, w: leftW, h: 3.5,
      fontSize: 11, color: "333333", align: "left", valign: "top",
    });

    // Right column: image
    if (char.imageUrl) {
      try {
        const b64 = await blobToBase64(char.imageUrl!);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 1, h: 1 });
          img.src = `data:image/png;base64,${b64}`;
        });
        const fit = fitImage(dims, rightW, rightH);
        slide.addImage({
          data: `data:image/png;base64,${b64}`,
          x: fit.x, y: fit.y, w: fit.w, h: fit.h,
        });
      } catch {
        // skip image
      }
    }
  }

  // Scene slides
  for (const scene of scenes) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // Left column: text
    slide.addText(scene.name || "Unnamed Scene", {
      x: margin, y: 1.5, w: leftW, h: 0.5,
      fontSize: 22, bold: true, color: "000000", align: "left",
    });
    if (scene.location) {
      slide.addText(scene.location, {
        x: margin, y: 2.05, w: leftW, h: 0.3,
        fontSize: 10, color: "777777", align: "left",
      });
    }
    slide.addText(scene.description || "No description", {
      x: margin, y: scene.location ? 2.5 : 2.2, w: leftW, h: 3.5,
      fontSize: 11, color: "333333", align: "left", valign: "top",
    });

    // Right column: image
    if (scene.imageUrl) {
      try {
        const b64 = await blobToBase64(scene.imageUrl!);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 1, h: 1 });
          img.src = `data:image/png;base64,${b64}`;
        });
        const fit = fitImage(dims, rightW, rightH);
        slide.addImage({
          data: `data:image/png;base64,${b64}`,
          x: fit.x, y: fit.y, w: fit.w, h: fit.h,
        });
      } catch {
        // skip image
      }
    }
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}
