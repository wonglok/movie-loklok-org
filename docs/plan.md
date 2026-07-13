# GUI vs Agentic Chat Interface: Balance Plan

## Current State

The project is a fully GUI-driven AI Video Studio. Every interaction follows the form → button → result pattern: write a story in a textarea, click "Extract Characters", get a grid of character cards, click "Generate All Character Images", and so on. The interface is a single scrollable page with sections for Story, Language, Art Direction, Characters, Scenes, Movie Editor, and Export.

There is no conversational interface. The existing "agent" system (`agent-queue.ts`, `agent-pipelines.ts`, `AgentProgressPanel.tsx`) is a background job queue for AI generation tasks — not a chat agent. All AI calls are one-shot function invocations with no streaming, no history, and no dialogue.

## Why the Current GUI Works

The GUI model maps naturally to the domain. Making a movie is a pipeline with distinct, ordered stages: define story → extract characters → generate character images → extract scenes → generate scene images → generate videos → stitch → export. Each stage has a clear trigger and produces visible artifacts. Users can inspect, edit, and regenerate each artifact independently. The card-based layout gives direct manipulative access to every character and scene.

This is the right model for **precision work** — tweaking a character description, adjusting a scene's dialogue line, changing video resolution for one specific scene. These are inherently spatial and direct-manipulation tasks, not conversational ones.

## Where a Chat Interface Would Add Value

The current GUI has friction points that an agentic chat interface would solve:

1. **Discovery and onboarding.** A new user faces a blank textarea labeled "Story" and a grid of art style buttons. They don't know what to write, how detailed to be, what the AI can do, or what order to do things in. A chat agent could interview them: "What kind of movie do you want to make? Give me a rough idea and I'll help you flesh it out."

2. **Iterative refinement.** Currently, if a scene description is off, the user clicks "Desc" to regenerate it. If it's still off, they click again. There's no way to say "make it darker" or "add a twist ending" — each regeneration is a blind roll of the dice. A chat agent could accept natural language feedback and iterate.

3. **Multi-step orchestration.** Running the full pipeline (characters → images → scenes → images → scripts → videos) requires clicking 6+ buttons across multiple scroll positions. An agent could handle this: "Generate everything for my project" and it queues the full pipeline, reporting progress as it goes.

4. **Creative collaboration.** The story textarea is a lonely place. An agent could act as a co-writer: suggesting plot twists, pointing out inconsistencies ("your detective character is described as meticulous but scene 3 has them rushing in unprepared"), or proposing visual treatments for specific scenes.

5. **Undo/conversation history.** Every AI generation overwrites the previous result. There's no history of what was tried. A chat thread naturally preserves this — you can scroll back to see the first version of a character, the second attempt at a scene description, the prompt that produced that image.

## What the GUI Should Keep

The chat interface should complement, not replace, the GUI. These elements must remain visual and direct:

- **Character cards with images.** You can't describe a character's appearance in chat as effectively as looking at their generated image. The card grid is the canonical representation.
- **Scene cards with dialogue editing.** Editing conversation lines line-by-line in chat would be miserable. The structured form (person + line, add/remove rows) is the right tool.
- **Video playback.** Previewing generated clips needs a video player, not a chat bubble.
- **Art style selection.** The emoji grid of 6 preset styles is a one-click choice. Chat would turn it into a paragraph of back-and-forth.
- **Movie Editor (FFmpeg stitching).** This is a purely technical operation with progress bars — no conversation needed.
- **Export/download.** File operations belong in toolbars and buttons, not chat.

## Proposed Hybrid Architecture

### Layout: Sidebar Chat + Main Canvas

```
+--------------------------------------------------+
| Header (ProjectSwitcher, Settings)                |
+------+-------------------------------------------+
|      |  Story | Language | Art Direction          |
| Chat |  Characters (card grid)                   |
|Panel |  Scenes (card grid + batch actions)       |
|      |  Movie Editor | Export                    |
|      |                                           |
|      |                                           |
+------+-------------------------------------------+
| AgentProgressPanel (bottom-right, persists)       |
+--------------------------------------------------+
```

- **Chat panel**: collapsible left sidebar (~360px wide). Toggle with a button or keyboard shortcut. Default: open for new users with no projects, collapsed for returning users with active projects.
- **Main canvas**: the current scrollable GUI, unchanged. This is the "document" the agent operates on.

### Chat Agent Capabilities

The chat agent should have tool access to read and modify project state. It's not a passive chatbot — it can act on the user's behalf:

| Tool                           | What it does                                     |
| ------------------------------ | ------------------------------------------------ |
| `read_story`                   | Get current story text                           |
| `update_story(text)`           | Set or append to the story                       |
| `list_characters`              | Get all characters with their descriptions       |
| `update_character(id, fields)` | Modify a character's name, description, etc.     |
| `create_character(fields)`     | Add a new character                              |
| `delete_character(id)`         | Remove a character (with confirmation)           |
| `list_scenes`                  | Get all scenes with descriptions and dialogue    |
| `update_scene(id, fields)`     | Modify a scene                                   |
| `create_scene(fields)`         | Add a new scene                                  |
| `extract_characters`           | Run AI character extraction from story           |
| `extract_scenes`               | Run AI scene extraction from story               |
| `generate_character_image(id)` | Generate image for one character                 |
| `generate_scene_image(id)`     | Generate image for one scene                     |
| `generate_scene_video(id)`     | Generate video for one scene                     |
| `generate_all_images(type)`    | Batch generate all character or scene images     |
| `run_full_pipeline`            | Run the complete generation pipeline             |
| `set_art_style(style)`         | Change the art style                             |
| `set_language(lang)`           | Change the language                              |
| `export_zip`                   | Export project as ZIP                            |
| `get_project_status`           | Summary of what's been generated and what hasn't |

### Interaction Patterns

**Pattern 1: Guided Onboarding (chat-driven)**

```
Agent: Welcome! I see you haven't created a project yet.
       What kind of movie would you like to make?

User:  A noir detective story set in 1940s Shanghai

Agent: Great choice. Let me set that up. [calls create_project, set_art_style("film-noir")]
       I've created your project. Let me draft a story outline for you...

       [calls update_story with a generated draft]

       Here's a starting point. You can edit it in the Story panel on the right,
       or tell me what you'd like to change. Ready to extract characters?
```

**Pattern 2: Iterative Refinement (GUI-driven, chat-assisted)**

```
User clicks "Desc" on a scene card → result appears

User (in chat): The scene description is too cheerful. Make it darker and add rain.

Agent: [calls update_scene, regenerates description with the feedback]
       Done — I've updated "Rooftop Confrontation" with a darker tone and
       rain. The new description is visible in the scene card.
```

**Pattern 3: Pipeline Orchestration (chat-driven)**

```
User:  Generate everything for me

Agent: Starting the full pipeline:
       1. Character images (3 characters)...
       2. Scene images (5 scenes)...
       3. Scene scripts...
       4. Scene videos...

       [Each step updates the GUI in real-time as jobs complete]

       All done! 8/8 items generated successfully.
       One scene video failed — would you like me to retry?
```

**Pattern 4: Creative Consultant (chat-driven)**

```
User:  What do you think is missing from my story?

Agent: Looking at your 5 scenes... your detective character Li Wei is described
       as "meticulous and observant" but in Scene 2, he misses an obvious clue
       that the audience would notice. This might feel inconsistent.

       Also, you have no scene showing the antagonist's motivation.
       Adding a scene from the villain's perspective could add depth.

       Want me to draft either of these?
```

### State Synchronization

This is the critical technical challenge. The GUI and chat agent share the same Zustand stores (`movie-store.ts`, `project-store.ts`, `agent-store.ts`). All mutations flow through the stores, so any change made by the agent is instantly reflected in the GUI and vice versa.

- **Agent writes to store → GUI re-renders** (React reactivity handles this)
- **User edits in GUI → agent is aware** (agent reads latest store state before each action)
- **Auto-save covers both paths** (the existing `useAutoSave` hook persists store state to disk regardless of who changed it)

No separate sync layer needed — the Zustand stores are the single source of truth.

### When to Use Which Interface

| Task                              | GUI                                | Chat                                     |
| --------------------------------- | ---------------------------------- | ---------------------------------------- |
| Write initial story               | textarea (better for long form)    | brainstorming (better for ideation)      |
| Fine-tune a character description | CharacterCard (direct editing)     | Chat ("make him older and more cynical") |
| Edit dialogue lines               | SceneCard form (structured)        | —                                        |
| Generate a single image           | Card button (one click)            | Chat if with specific instructions       |
| Batch generate everything         | Batch action bar                   | Chat ("generate all scene images")       |
| Iterate on a bad generation       | Regenerate button                  | Chat with feedback ("darker, add rain")  |
| Change art style                  | Style grid (instant visual choice) | —                                        |
| Video playback                    | SceneCard player                   | —                                        |
| Export/download                   | Export section buttons             | Chat ("export my project as ZIP")        |
| First-time onboarding             | —                                  | Chat agent (guided interview)            |
| Creative feedback                 | —                                  | Chat agent (holistic view)               |
| Pipeline orchestration            | —                                  | Chat agent (multi-step with progress)    |

## Implementation Phases

### Phase 1: Chat Sidebar Shell

- Add a collapsible sidebar component with toggle button
- Basic chat UI: message list, input field, send button
- Store chat history per project
- No AI integration yet — just the shell

### Phase 2: Tool Definitions + Store Bridge

- Define the tool schema (TypeScript interfaces for each tool)
- Implement tool execution functions that read/write Zustand stores
- Add tool call rendering in chat (show what the agent is doing)
- Wire up the existing agent queue for progress reporting in chat

### Phase 3: AI Agent Backend

- Add an LLM chat endpoint (extend `fal.ts` with a chat/completion function using OpenRouter)
- Implement system prompt with tool definitions
- Handle streaming responses with tool-use parsing
- Connect tool calls to the bridge from Phase 2

### Phase 4: Onboarding Flow

- Auto-open chat panel for new users (no projects)
- Guided interview flow: idea → outline → characters → art style
- Each step populates the GUI in real-time so users learn both interfaces

### Phase 5: Polish

- Markdown rendering in chat messages
- Tool call confirmation for destructive actions (delete character, overwrite story)
- Keyboard shortcut to toggle chat panel
- Conversation export (save chat history as part of project)

## Design Principles

1. **The GUI is the document, the chat is the collaborator.** The GUI shows the current state of the project. The chat helps you change it. The chat should never be the only way to see what's in your project.

2. **Every chat action has a GUI reflection.** If the agent generates a character image, the CharacterCard updates in real-time. Users learn the GUI by watching the agent use it.

3. **No feature requires chat.** Power users who know the tool can do everything through the GUI. Chat is an accelerator, not a gate.

4. **Chat remembers, GUI shows.** The chat history provides undo/redo and provenance ("why does this character look like that? → scroll up to see the prompt"). The GUI shows the current state.

5. **One source of truth.** Both interfaces read and write the same Zustand stores. No duplicate state, no sync bugs.

## Risks and Mitigations

| Risk                                        | Mitigation                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Chat panel competes for screen space        | Collapsible; defaults to collapsed for returning users; keyboard shortcut                      |
| Users confused about which interface to use | Both work simultaneously; watching the GUI update as the agent works teaches the mapping       |
| LLM tool calls fail or produce bad output   | Tools validate against store schemas; errors surface in chat; user can always fall back to GUI |
| Chat history grows unbounded                | Per-project history with message cap; older messages summarized                                |
| API cost of chat LLM calls                  | Use a lightweight model for chat routing; reserve expensive models for generation tasks        |
