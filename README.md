# Studdiebuddie

Läxapp för 11–15-åringar: planera läxor, få påminnelser, fota häftet, AI-förhör som **ställer frågor** (inte ger svar), anteckningar, sammanfattningsplugg och provresultat.

## Starta

```bash
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

## Vad finns i MVP

- **Läxor** – skapa, fota, skriv vad du behöver hjälp med, sidhänvisningar, påminnelser
- **Förhörsrum** – frågor utifrån läxtext; tips vid fel (t.ex. “sid 4”); omskrivna frågor; träna det du missade
- **Anteckningsblock**
- **Sammanfattningsplugg** – plugga ihop läxor över 1–12 månader inför stora prov
- **Provresultat** – fyll i efteråt och se fokusområden

Data sparas lokalt i webbläsaren (localStorage). Demo-läxor skapas första gången.

## Nästa steg (riktig AI)

Byt ut `src/lib/ai-quiz.ts` mot ett API (t.ex. OpenAI) som:
1. läser foto/OCR av läxan
2. genererar frågor **utan** att visa facit till eleven
3. rättar semantiskt och ger tips med sidhänvisning
