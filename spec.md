# AI MYSTERY ROOM
## Master Specification Document
**Specification for Spec-Driven Development (SDD)**

| Document Property | Details |
|---|---|
| Project Name | AI Mystery Room |
| Document Type | Master Product & Technical Specification |
| Version | 1.0 |
| Status | Development Specification |
| Development Approach | Spec-Driven Development |
| Frontend | React.js |
| Backend | Node.js + Express.js |
| Database | MongoDB |
| AI Provider | Google Gemini |
| Architecture | MERN Stack |
| Primary Development Agent | OpenAI Codex |

---

# 1. PROJECT OVERVIEW

## 1.1 Project Description

AI Mystery Room is an AI-powered interactive mystery investigation web application.

The application allows users to submit a short scenario, story, incident, or mystery premise. Based on the submitted information, the backend uses Google Gemini to generate a complete fictional investigation.

The generated investigation includes:

- A fictional crime or mysterious incident.
- A predefined set of suspects.
- One actual culprit.
- Individual suspect profiles.
- Evidence and investigation materials.
- A sequence of clues.
- An interconnected investigation storyline.
- A final explanation of what happened.

The user acts as an investigator and must examine the available evidence, connect the clues, identify contradictions, and determine who committed the fictional crime.

At the end of the investigation, the user selects a suspect as the culprit and submits their final decision.

The application evaluates the answer and reveals the actual culprit along with the explanation and supporting evidence.

**Core product concept:**

User Story → AI Investigation Generation → Evidence Collection → User Investigation → Culprit Selection → Result & Explanation.

## 1.2 Primary Objective

Create an engaging mystery-solving experience in which AI generates fictional investigations dynamically rather than relying on predefined mystery stories.

Each investigation should feel like a separate case with its own characters, evidence, relationships, and solution.

## 1.3 Target Experience

The application should feel like an interactive detective investigation rather than a conventional question-and-answer quiz.

Users should be able to:

1. Create a mystery using their own scenario.
2. Enter an investigation environment.
3. Examine different pieces of evidence.
4. Investigate suspects.
5. Compare statements and evidence.
6. Develop their own theory.
7. Accuse a suspect.
8. Discover whether their conclusion was correct.
9. Read the complete case explanation.

---

# 2. DEVELOPMENT PRINCIPLES

These principles must be followed throughout development.

## 2.1 Clean Implementation

The new project must be implemented from a clean project structure.

The previous implementation is to remain untouched and serve only as a reference and backup.

Do not copy the old implementation's source code into the new project.

Existing functionality, business logic, user workflows, and established requirements should be preserved through this specification rather than through copying potentially problematic code.

## 2.2 Preserve Existing Product Scope

The following are core requirements and must not be removed or unnecessarily redesigned:

- Scenario-based mystery generation.
- AI-generated investigation.
- Suspect management.
- Culprit determination.
- Evidence generation.
- WhatsApp-style conversations.
- Image evidence.
- CCTV-style recordings.
- Investigation interface.
- Culprit selection.
- Answer evaluation.
- Final case explanation.

## 2.3 Keep the Interface Simple

The application should have a clean, modern, and intuitive interface.

Only lightweight improvements should be made to:

- Dashboard.
- Sign-in page.
- Navigation.
- General layout.
- Evidence presentation.

Do not introduce unnecessary animations, complex dashboards, excessive settings, or unrelated features.

## 2.4 Phase-Based Development

Development must be completed in independent, verifiable phases.

Codex must not attempt to implement the entire application in one uncontrolled operation.

Every phase must have:

- Defined objectives.
- Required functionality.
- Implementation tasks.
- Acceptance criteria.
- Verification steps.

Do not proceed to the next phase until the current phase meets its acceptance criteria.

## 2.5 Specification Priority

This document is the primary source of truth.

If an implementation decision is not covered by this document:

1. Preserve existing core product functionality.
2. Prefer the simplest maintainable implementation.
3. Do not introduce unrelated features.
4. Document important assumptions.
5. Ask for clarification when a decision could change core functionality.

---

# 3. FUNCTIONAL REQUIREMENTS

## 3.1 User Authentication

Users should be able to access the application through a simple authentication system.

### Required functionality

- User registration.
- User login.
- User logout.
- Authentication validation.
- Protected dashboard and investigation routes.
- Session persistence.
- Appropriate error messages.

### Registration fields

- Name.
- Email.
- Password.
- Confirm Password (frontend validation).

### Login fields

- Email.
- Password.

### Requirements

- Passwords must be securely hashed before storage.
- Passwords must never be returned through APIs.
- Protected routes must verify authentication.
- Users must only access their own private investigations.

Authentication should remain simple. Social login and third-party authentication are outside the initial scope.

## 3.2 Dashboard

The dashboard is the user's primary entry point after authentication.

### Dashboard components

1. Application branding and navigation.
2. Welcome section.
3. Create New Mystery button.
4. Previously created investigations.
5. Investigation status.
6. Basic user account controls.

### Investigation history

Display previously generated investigations with:

- Investigation title.
- Short description.
- Creation date.
- Investigation status.
- Action to continue or view results.

Possible investigation statuses:

- Generating.
- Ready.
- In Progress.
- Completed.
- Failed.

A failed investigation should provide an understandable error and an appropriate retry option.

## 3.3 Mystery Creation

The user should be able to create a new investigation by providing a scenario.

### Input

The user enters a short description of the mystery they want to investigate.

Example:

"A businessman was found unconscious in his locked office. Three employees had access to the room, and one of them appears to be hiding something."

### Input requirements

- Scenario description is required.
- Empty submissions must be rejected.
- Maximum scenario length must be configurable.
- Input must be validated on both frontend and backend.
- Loading feedback must be displayed while generating the investigation.

### Optional configuration

The initial implementation should support the core scenario input without requiring users to configure complicated settings.

Difficulty, number of suspects, and other customization options should only be introduced when explicitly approved.

## 3.4 AI Investigation Generation

This is the central functionality of AI Mystery Room.

The backend sends the user's scenario to Google Gemini.

Gemini generates a structured fictional investigation.

### Required investigation information

**A. Case Information**

- Case ID.
- Investigation title.
- Case description.
- Incident summary.
- Location.
- Incident date and time.
- Investigation background.

**B. Incident Details**

- What happened.
- How the incident occurred.
- Important events.
- Relevant timeline.
- Possible motives.

**C. Suspects**

Each investigation must contain multiple suspects.

Every suspect should have:

- Unique suspect ID.
- Full name.
- Age.
- Occupation or role.
- Short biography.
- Relationship with the incident or victim.
- Possible motive.
- Alibi.
- Relevant background information.

**D. Culprit**

The generated investigation must contain exactly one actual culprit.

The culprit must be established during generation.

The culprit must not change during the investigation.

The culprit information must remain private on the backend until the user submits their accusation.

**E. Evidence**

The investigation must contain multiple pieces of evidence.

Evidence should be connected to:

- Suspects.
- Incident timeline.
- Investigation events.
- Statements.
- Motives.
- Important contradictions.

**F. Investigation Solution**

The backend must retain:

- Actual culprit.
- Explanation of the crime.
- Sequence of events.
- Important clues.
- Explanation of misleading evidence.
- Evidence supporting the actual culprit.

This information is required to evaluate the user's final answer.

### Critical generation requirement

The investigation must be logically consistent.

For example:

If a suspect claims they were at home at 9 PM, but a CCTV recording shows them entering the crime location at 9:15 PM, the contradiction should have a meaningful explanation.

The AI must not generate random evidence that has no connection to the actual investigation.

---

# 4. EVIDENCE MANAGEMENT SYSTEM

Evidence is the main interactive component of the application.

All evidence must be associated with a particular investigation.

Every evidence item must have:

- Evidence ID.
- Investigation ID.
- Evidence type.
- Title.
- Description.
- Generated content or media reference.
- Associated suspect IDs, where applicable.
- Timeline information, where applicable.
- Display order.
- Generation status.

## 4.1 WhatsApp-Style Messages

The AI should generate fictional chat conversations that help users understand relationships, events, and possible motives.

### Required information

- Sender.
- Receiver or group participants.
- Message text.
- Timestamp.
- Optional attachments.
- Conversation identifier.

### UI presentation

Display conversations in a familiar chat-style layout.

Messages should be arranged chronologically.

The design may resemble a messaging application, but must not imply that the conversations are real WhatsApp records.

## 4.2 Image Evidence

The AI should generate fictional images relevant to the investigation.

Examples:

- Crime scene photographs.
- Objects found at the location.
- Suspicious items.
- Photographs of relevant locations.
- Documents or other visual evidence.

### Requirements

- Images must belong to the investigation.
- Each image must have a title and description.
- Images must be accessible through the evidence interface.
- Images should support an enlarged viewing mode.
- Image generation failures must not break the investigation.

The image generation process should use a supported Google image-generation model through a separate media-generation adapter where necessary.

## 4.3 CCTV-Style Recordings

The investigation should support fictional CCTV-style recordings.

Examples:

- A person entering a room.
- Someone leaving a building.
- Suspicious movement.
- An object being transferred.
- A timeline-related event.

### Required information

- Recording title.
- Camera location.
- Recording timestamp.
- Duration.
- Description.
- Media reference.
- Associated suspects, if applicable.

The preferred implementation is an actual generated video using a supported Google video-generation service.

If video generation is unavailable, the system must support a clearly identified simulated CCTV recording using AI-generated frames and playback.

The system must never present a collection of still images as an actual recorded video.

## 4.4 Additional Evidence Types

The evidence system should be extensible.

Potential evidence categories include:

- Documents.
- Emails.
- Written statements.
- Medical reports.
- Location records.
- Audio recordings.

These categories should not delay implementation of the primary evidence types.

## 4.5 Evidence Reliability and Logical Consistency

Each evidence item should have an internal purpose.

Evidence may be:

- Directly incriminating.
- Supporting.
- Contradictory.
- Misleading.
- Neutral.

The AI must ensure that misleading evidence is intentional and explainable.

Evidence should not reveal the culprit immediately.

The solution should be discoverable by comparing multiple pieces of evidence.

---

# 5. INVESTIGATION INTERFACE

The investigation interface should be the primary user experience after a case is generated.

## 5.1 Investigation Layout

The interface should contain:

**Case Overview**
- Investigation title.
- Incident summary.
- Case information.

**Suspect Section**
- Suspect profiles.
- Background information.
- Statements and alibis.

**Evidence Section**
- All generated evidence.
- Evidence category filters.
- Evidence detail viewer.

**Investigation Progress**
- Case status.
- Reviewed evidence count.
- Accusation status.

**Final Accusation**
- Suspect selection.
- Submit accusation action.

## 5.2 Evidence Interaction

Users must be able to:

- Open evidence.
- Read messages.
- Examine images.
- View CCTV recordings.
- Review suspect profiles.
- Compare information across evidence items.

Evidence should remain accessible throughout the investigation.

Users must not lose previously generated evidence when navigating between sections.

## 5.3 Investigation Progress

The system should maintain the user's investigation state.

At minimum, store:

- Investigation status.
- Evidence viewed by the user.
- Selected suspect, if an accusation is submitted.
- Final result.

The user should be able to leave an investigation and resume it later.

---

# 6. CULPRIT SELECTION AND RESULT EVALUATION

## 6.1 Culprit Selection

After investigating the available evidence, the user must select one suspect.

The application should provide a clear selection interface.

The user must confirm the final accusation before submission.

## 6.2 Answer Submission

When the user submits an accusation:

1. Validate the selected suspect ID.
2. Verify that the suspect belongs to the investigation.
3. Verify that the investigation is eligible for submission.
4. Compare the selected suspect with the actual culprit stored on the backend.
5. Save the accusation.
6. Return the result.

The frontend must never determine the correct answer.

## 6.3 Result Screen

The result screen should display:

- Selected suspect.
- Correct or incorrect result.
- Actual culprit.
- Explanation of the incident.
- Important evidence supporting the conclusion.
- Explanation of misleading clues.
- Complete sequence of events.

The result should be understandable even for users who selected the wrong suspect.

## 6.4 Investigation Completion

Once an accusation is submitted, the investigation should be marked as completed.

The original accusation must remain recorded.

The initial implementation should allow one final accusation per investigation.

Do not introduce unlimited retries or answer changes unless explicitly approved.

---

# 7. APPLICATION ARCHITECTURE

## 7.1 Architecture Overview

The application follows the MERN architecture.

Frontend:
React.js

Backend:
Node.js + Express.js

Database:
MongoDB

AI:
Google Gemini

### Application flow

User
→ React Frontend
→ Express API
→ Authentication and Business Logic
→ MongoDB

For AI generation:

Express Backend
→ AI Service Layer
→ Google Gemini
→ Structured Investigation Data
→ Validation
→ MongoDB

For media:

Express Backend
→ Media Generation Adapter
→ Supported Google Media Generation Model
→ Media Storage
→ MongoDB Media Reference

### Important architecture rule

Gemini API keys and media-generation credentials must remain on the backend.

The frontend must never communicate directly with privileged AI APIs.

## 7.2 Recommended Project Structure

Use a clean separation between frontend and backend.

    ai-mystery-room/
    │
    ├── client/
    │   ├── public/
    │   └── src/
    │       ├── assets/
    │       ├── components/
    │       │   ├── common/
    │       │   ├── dashboard/
    │       │   ├── investigation/
    │       │   ├── evidence/
    │       │   └── suspects/
    │       │
    │       ├── pages/
    │       │   ├── Login.jsx
    │       │   ├── Register.jsx
    │       │   ├── Dashboard.jsx
    │       │   ├── CreateMystery.jsx
    │       │   ├── Investigation.jsx
    │       │   └── Result.jsx
    │       │
    │       ├── services/
    │       ├── hooks/
    │       ├── context/
    │       ├── routes/
    │       ├── utils/
    │       ├── styles/
    │       ├── App.jsx
    │       └── main.jsx
    │
    ├── server/
    │   ├── config/
    │   ├── controllers/
    │   ├── middleware/
    │   ├── models/
    │   ├── routes/
    │   ├── services/
    │   │   ├── ai/
    │   │   ├── investigation/
    │   │   └── media/
    │   │
    │   ├── validators/
    │   ├── prompts/
    │   ├── utils/
    │   ├── app.js
    │   └── server.js
    │
    ├── docs/
    │   ├── SPEC.md
    │   ├── ARCHITECTURE.md
    │   ├── API.md
    │   ├── DATABASE.md
    │   └── DEVELOPMENT.md
    │
    ├── .env.example
    ├── .gitignore
    └── README.md

This structure is a recommended starting point. Small adjustments are acceptable when they improve maintainability without changing the architecture or requirements.

---

# 8. DATABASE DESIGN

MongoDB will store user accounts, investigations, evidence, and investigation progress.

Use Mongoose for schema definition and database interaction.

## 8.1 User Collection

Collection: `users`

Fields:

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Unique user ID |
| name | String | User's name |
| email | String | Unique email |
| passwordHash | String | Hashed password |
| createdAt | Date | Registration date |
| updatedAt | Date | Last update |

## 8.2 Investigation Collection

Collection: `investigations`

Fields:

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Investigation ID |
| userId | ObjectId | Owner |
| title | String | Case title |
| scenario | String | Original user input |
| description | String | Generated case description |
| incidentDetails | Object | Incident information |
| suspects | Array | Suspect profiles |
| timeline | Array | Chronological events |
| solution | Object | Private solution |
| evidence | Array | Evidence references |
| status | String | Generation/investigation status |
| difficulty | String | Optional difficulty |
| generationError | Object | Failure information |
| createdAt | Date | Creation date |
| updatedAt | Date | Last update |

### Suspect subdocument

- suspectId
- name
- age
- occupation
- biography
- relationshipToIncident
- motive
- alibi
- profileImageReference (optional)

### Solution subdocument

- culpritSuspectId
- crimeExplanation
- actualSequenceOfEvents
- supportingEvidenceIds
- misleadingEvidenceExplanations
- finalExplanation

**Security requirement:** The solution must never be included in normal investigation responses.

## 8.3 Evidence Collection

Collection: `evidences`

Fields:

| Field | Type | Description |
|---|---|---|
| _id | ObjectId | Evidence ID |
| investigationId | ObjectId | Parent investigation |
| type | String | Evidence category |
| title | String | Evidence title |
| description | String | Evidence description |
| content | Mixed | Structured evidence content |
| media | Array | Media references |
| associatedSuspects | Array | Related suspect IDs |
| timestamp | Date/String | Incident-related time |
| reliability | String | Internal evidence classification |
| displayOrder | Number | Display sequence |
| generationStatus | String | Generation status |
| createdAt | Date | Creation date |

Supported initial types:

- chat
- image
- cctv

Chat content should store individual messages with sender, receiver, text, and timestamp.

Image content should store its description and generated media reference.

CCTV content should store camera details, recording time, duration, and media reference.

## 8.4 Investigation Progress Collection

Collection: `investigationProgress`

Fields:

- _id
- userId
- investigationId
- viewedEvidenceIds
- accusation
- result
- startedAt
- completedAt
- updatedAt

The accusation subdocument should contain:

- selectedSuspectId
- submittedAt
- isCorrect

The result must be derived by the backend.

## 8.5 Database Rules

- All investigation records must belong to a valid user.
- Evidence must reference an existing investigation.
- Suspect IDs must be unique within an investigation.
- Evidence IDs must be unique.
- A user must not access another user's investigations.
- Deleting an investigation must also clean up its associated media and progress records.
- Index frequently queried fields such as userId, investigationId, and email.

---

# 9. BACKEND API SPECIFICATION

Base URL:

`/api`

All API responses should follow a consistent structure.

Success:

    {
      "success": true,
      "message": "Operation successful",
      "data": {}
    }

Failure:

    {
      "success": false,
      "message": "Readable error message",
      "error": {
        "code": "ERROR_CODE"
      }
    }

## 9.1 Authentication APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Authenticate user |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get authenticated user |

## 9.2 Dashboard APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/investigations | Get user's investigations |
| GET | /api/investigations/:id | Get investigation overview |
| DELETE | /api/investigations/:id | Delete investigation |

## 9.3 Mystery Generation APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/investigations | Start mystery generation |
| GET | /api/investigations/:id/status | Check generation status |

Generation should use an asynchronous workflow.

The API should return an investigation ID and generation status rather than keeping the original request open for a potentially long-running media-generation process.

The frontend can poll the status endpoint until generation finishes or fails.

## 9.4 Evidence APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/investigations/:id/evidence | Get investigation evidence |
| GET | /api/evidence/:id | Get individual evidence |
| POST | /api/investigations/:id/evidence/:evidenceId/viewed | Mark evidence as viewed |

All evidence endpoints must verify ownership.

## 9.5 Accusation APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/investigations/:id/accuse | Submit culprit selection |
| GET | /api/investigations/:id/result | Retrieve completed result |

The accusation endpoint must reject:

- Invalid suspect IDs.
- Suspects from another investigation.
- Repeated final submissions.
- Unauthorized users.
- Investigations that are not ready.

The result endpoint must only return the solution after the accusation has been submitted.

---

# 10. GOOGLE GEMINI INTEGRATION

## 10.1 AI Service Responsibilities

Google Gemini is responsible for generating the fictional investigation.

The AI service should handle:

1. Scenario interpretation.
2. Case creation.
3. Suspect generation.
4. Culprit selection.
5. Motive creation.
6. Timeline generation.
7. Evidence generation.
8. Logical consistency.
9. Final solution generation.

The AI integration must be isolated from Express controllers.

Recommended service modules:

- investigationGenerator
- suspectGenerator
- evidenceGenerator
- consistencyValidator
- solutionGenerator

These may be combined where appropriate to avoid unnecessary complexity.

## 10.2 Structured AI Output

Gemini should return structured JSON rather than free-form paragraphs for the core investigation.

The backend must validate the generated output against a defined schema.

Example:

    {
      "case": {
        "title": "The Locked Office",
        "description": "A businessman is found unconscious.",
        "incidentLocation": "Office Building",
        "incidentTime": "21:00"
      },
      "suspects": [
        {
          "suspectId": "S1",
          "name": "Alex",
          "occupation": "Manager",
          "motive": "Financial dispute",
          "alibi": "Claims to have left at 8 PM"
        }
      ],
      "timeline": [],
      "evidence": [],
      "solution": {
        "culpritSuspectId": "S1",
        "explanation": "Private solution explanation",
        "supportingEvidenceIds": []
      }
    }

This is an illustrative structure, not a fixed final generation payload.

The actual schema must include all required fields from this document.

## 10.3 AI Generation Pipeline

Recommended sequence:

**Step 1: Scenario Analysis**

Gemini interprets the user's scenario.

**Step 2: Investigation Generation**

Generate the case, suspects, culprit, motives, and actual event sequence.

**Step 3: Evidence Planning**

Generate evidence that supports, contradicts, or misleads.

**Step 4: Evidence Generation**

Generate individual WhatsApp-style conversations, image descriptions, and CCTV recording plans.

**Step 5: Logical Validation**

Check consistency between:

- Culprit.
- Motive.
- Timeline.
- Suspect alibis.
- Evidence.
- Final solution.

**Step 6: Media Generation**

Generate image and video assets using supported Google media-generation models.

**Step 7: Database Storage**

Store the investigation and its evidence.

**Step 8: Publish Investigation**

Only mark the investigation Ready when all mandatory content is available.

If optional media generation fails, the system should preserve the investigation and display a clearly identified fallback or unavailable-media state.

## 10.4 Prompt Engineering Requirements

Prompts must be stored separately from application controllers.

Prompts must instruct the AI to:

- Generate fictional content only.
- Follow the supplied scenario.
- Create exactly one actual culprit.
- Create multiple plausible suspects.
- Maintain a consistent timeline.
- Ensure evidence is logically connected.
- Avoid contradictory information unless intentionally misleading.
- Ensure the solution can be discovered through evidence.
- Avoid revealing the culprit in user-visible evidence.
- Return valid structured JSON.

The AI must not independently reveal the answer in the investigation title, descriptions, messages, or media captions.

## 10.5 Generation Validation

The backend must validate:

- Valid JSON.
- Required fields.
- Unique suspect IDs.
- Exactly one valid culprit.
- At least two suspects.
- Valid evidence references.
- Timeline consistency.
- Evidence-to-suspect relationships.
- Supporting evidence for the actual culprit.

Invalid responses must not be saved as Ready investigations.

A controlled retry mechanism should be used for malformed AI responses.

Avoid unlimited AI retries.

## 10.6 AI Provider Configuration

Keep model names and API configuration in environment variables.

Example:

    GEMINI_API_KEY=
    GEMINI_TEXT_MODEL=
    GEMINI_IMAGE_MODEL=
    GEMINI_VIDEO_MODEL=

Only configure media models that are actually available to the project.

Do not assume that the text-generation model automatically generates images or videos.

Use separate adapters for text, image, and video generation.

---

# 11. MEDIA GENERATION AND STORAGE

## 11.1 Media Generation

All generated evidence must be fictional.

The application should distinguish between:

- Text generated by Gemini.
- Images generated by an image-generation model.
- Videos generated by a video-generation model.

The backend should maintain a common media interface so that the provider can be configured without rewriting investigation logic.

## 11.2 Media Storage

Do not store large image or video binary data directly inside MongoDB documents.

Store files in a media-storage layer.

MongoDB should contain:

- Media ID.
- Investigation ID.
- Evidence ID.
- Media type.
- Storage reference.
- MIME type.
- Generation status.

Use local storage during development.

The production storage provider can be configured separately without changing the database design.

## 11.3 Media Failure Handling

If image or video generation fails:

- Record the failure.
- Preserve the evidence metadata.
- Display an appropriate status.
- Allow controlled regeneration where applicable.
- Never silently substitute unrelated media.

---

# 12. FRONTEND DESIGN SPECIFICATION

## 12.1 General Design Direction

The website should have a modern detective-investigation atmosphere.

Design principles:

- Clean layout.
- Strong readability.
- Consistent typography.
- Clear visual hierarchy.
- Responsive design.
- Simple navigation.
- Limited decorative elements.

The interface should feel immersive without making basic navigation difficult.

## 12.2 Sign-in and Registration Pages

Required elements:

- Application logo.
- Welcome heading.
- Email input.
- Password input.
- Submit button.
- Registration/login navigation.
- Validation messages.

Keep the design visually attractive but minimal.

## 12.3 Dashboard

Required elements:

- Welcome message.
- Create Mystery action.
- Previous investigations.
- Investigation status indicators.
- User account controls.

Avoid unnecessary charts, analytics, or complex administration panels.

## 12.4 Create Mystery Page

Required elements:

- Scenario text area.
- Short instructions.
- Generate Mystery button.
- Loading state.
- Input validation.
- Generation error handling.

## 12.5 Investigation Page

Use clear sections or navigation tabs:

- Case Overview.
- Suspects.
- Evidence.
- Timeline.
- Final Accusation.

Evidence should be easy to discover and examine.

## 12.6 Result Page

Show:

- User's accusation.
- Correct/incorrect status.
- Actual culprit.
- Final explanation.
- Supporting evidence.
- Investigation timeline.

## 12.7 Responsive Design

The application must work on:

- Desktop.
- Laptop.
- Tablet.
- Mobile.

Evidence viewing must remain usable on smaller screens.

---

# 13. SECURITY REQUIREMENTS

Security must be implemented at the backend level.

Required protections:

1. Password hashing using bcrypt or an equivalent secure password-hashing algorithm.
2. Authentication middleware.
3. Authorization and investigation ownership checks.
4. Input validation and sanitization.
5. Rate limiting on authentication and AI-generation endpoints.
6. Secure environment variable management.
7. Protection against unauthorized access to media.
8. Appropriate CORS configuration.
9. Safe error handling.
10. No exposure of Gemini API keys.
11. No exposure of the actual culprit before accusation.
12. No storage of plaintext passwords.

Use secure HTTP-only authentication cookies or an equivalently secure authentication mechanism.

Never trust user-supplied investigation IDs, suspect IDs, or ownership information without backend verification.

---

# 14. ERROR HANDLING AND APPLICATION STATES

The application must provide clear feedback for the following situations.

| Situation | Expected Behaviour |
|---|---|
| Invalid login | Display authentication error |
| Empty scenario | Reject submission |
| Gemini failure | Mark generation failed |
| Invalid AI JSON | Validate and retry within limits |
| MongoDB unavailable | Display service error |
| Image generation failure | Preserve case and report media status |
| Video generation failure | Display unavailable or approved fallback |
| Unauthorized request | Return 401 |
| Forbidden resource | Return 403 |
| Investigation not found | Return 404 |
| Duplicate accusation | Reject submission |
| Network failure | Provide retry option |

Use appropriate HTTP status codes.

Errors must not expose API keys, database credentials, private solution information, or internal stack traces.

---

# 15. NON-FUNCTIONAL REQUIREMENTS

## Performance

- Avoid blocking the main application while generating media.
- Use asynchronous generation.
- Load evidence when required.
- Optimize media delivery.
- Avoid unnecessary database queries.

## Reliability

- Preserve completed investigations.
- Handle partial generation failures.
- Prevent duplicate investigation creation.
- Maintain stable investigation IDs.
- Validate all AI-generated content.

## Maintainability

- Separate frontend and backend responsibilities.
- Separate AI logic from business logic.
- Keep prompts outside controllers.
- Use reusable components.
- Maintain consistent API responses.
- Keep database schemas structured.

## Scalability

- Support multiple users.
- Keep investigation ownership separate.
- Avoid shared mutable investigation state.
- Design media generation so it can be moved to background workers later.

---

# 16. DEVELOPMENT PHASES

Development must follow the order below.

Each phase must be completed and verified before proceeding.

## Phase 0 — Project Foundation

Objectives:

- Create a clean project.
- Initialize React frontend.
- Initialize Express backend.
- Configure MongoDB connection.
- Set up environment variables.
- Configure frontend/backend communication.
- Establish folder structure.
- Verify both servers start successfully.

Acceptance criteria:

- Frontend loads.
- Backend responds to health check.
- MongoDB connection succeeds.
- Environment variables are loaded correctly.
- No secrets are committed.

## Phase 1 — Authentication and Dashboard

Objectives:

- Registration.
- Login.
- Logout.
- Protected routes.
- Dashboard layout.
- Investigation history structure.

Acceptance criteria:

- Users can register and log in.
- Unauthorized users cannot access protected pages.
- Dashboard loads correctly.
- User-specific investigation history is supported.

## Phase 2 — Mystery Generation

Objectives:

- Scenario submission.
- Gemini integration.
- Structured investigation generation.
- Suspect generation.
- Culprit assignment.
- Timeline generation.
- Solution storage.
- Investigation validation.

Acceptance criteria:

- User can submit a scenario.
- Gemini generates a complete investigation.
- At least two suspects are generated.
- Exactly one culprit is assigned.
- The solution remains private.
- Investigation is saved successfully.
- Invalid AI responses are handled.

## Phase 3 — Evidence Generation

Objectives:

- WhatsApp-style messages.
- Image evidence.
- CCTV recording generation.
- Evidence metadata.
- Media storage.
- Evidence-to-investigation relationships.

Acceptance criteria:

- All mandatory evidence categories are represented.
- Messages are displayed correctly.
- Images can be opened.
- CCTV media can be played or an explicitly identified fallback can be displayed.
- Evidence remains linked to its investigation.
- Media failures do not corrupt the case.

## Phase 4 — Investigation Interface

Objectives:

- Case overview.
- Suspect profiles.
- Evidence viewer.
- Timeline.
- Investigation navigation.
- Progress tracking.

Acceptance criteria:

- Users can access every generated evidence item.
- Suspect details are visible.
- Evidence viewing works.
- Investigation state persists.
- Users can resume an unfinished investigation.

## Phase 5 — Culprit Selection and Results

Objectives:

- Suspect selection.
- Final accusation.
- Backend evaluation.
- Result screen.
- Solution explanation.
- Investigation completion.

Acceptance criteria:

- Users can select a valid suspect.
- Backend evaluates the answer.
- Correct and incorrect results are handled.
- Actual culprit and explanation are revealed only after submission.
- Duplicate final accusations are prevented.

## Phase 6 — Testing and Final Integration

Objectives:

- Frontend testing.
- Backend testing.
- API testing.
- Database validation.
- AI response validation.
- Security testing.
- Responsive testing.
- Complete workflow verification.

Acceptance criteria:

- Complete user workflow works.
- No critical runtime errors.
- No unauthorized solution disclosure.
- No cross-user investigation access.
- Evidence generation and retrieval work.
- Application handles expected failures.

---

# 17. TESTING REQUIREMENTS

## 17.1 Authentication Testing

Test:

- Valid registration.
- Duplicate email.
- Invalid email.
- Incorrect password.
- Missing credentials.
- Unauthorized access.

## 17.2 AI Generation Testing

Test:

- Short scenario.
- Long scenario.
- Ambiguous scenario.
- Invalid scenario.
- Gemini API failure.
- Malformed JSON.
- Missing suspect.
- Missing culprit.
- Contradictory timeline.
- Missing evidence references.

## 17.3 Evidence Testing

Test:

- Chat rendering.
- Image generation.
- Image retrieval.
- CCTV playback.
- Missing media.
- Failed media generation.
- Unauthorized evidence access.

## 17.4 Investigation Testing

Test:

- Correct culprit selection.
- Incorrect culprit selection.
- Invalid suspect selection.
- Duplicate accusation.
- Investigation resumption.
- Solution privacy.
- Investigation ownership.

## 17.5 End-to-End Testing

The following complete workflow must work:

Register → Login → Dashboard → Create Mystery → Generate Investigation → View Suspects → Examine Evidence → Select Culprit → Submit → View Result.

This is the primary end-to-end acceptance test.

---

# 18. ENVIRONMENT CONFIGURATION

The following environment variables should be supported.

Backend:

    PORT=5000
    MONGODB_URI=
    GEMINI_API_KEY=
    GEMINI_TEXT_MODEL=
    GEMINI_IMAGE_MODEL=
    GEMINI_VIDEO_MODEL=
    JWT_SECRET=
    CLIENT_URL=
    NODE_ENV=development

Frontend:

    VITE_API_URL=http://localhost:5000/api

Use `.env.example` to document required configuration without including real credentials.

Do not hardcode secrets or model credentials in application source files.

---

# 19. DEFINITION OF DONE

The project is considered functionally complete when:

- A user can register and log in.
- A user can submit a custom scenario.
- Gemini generates a complete fictional investigation.
- The investigation contains multiple suspects.
- Exactly one actual culprit exists.
- The investigation contains interconnected evidence.
- WhatsApp-style evidence works.
- Image evidence works.
- CCTV-style evidence works.
- Users can investigate the case.
- Users can select a suspect.
- The backend evaluates their accusation.
- The result includes the actual culprit and complete explanation.
- Investigations are saved and can be resumed.
- User data and investigation data remain protected.
- The application works across desktop and mobile layouts.
- All major workflow tests pass.

---

# 20. CODEX DEVELOPMENT INSTRUCTIONS

These instructions are mandatory for the development agent.

## 20.1 Follow the Specification

Treat this document as the single source of truth.

Do not invent new product features.

Do not unnecessarily change the defined workflow.

Do not remove existing functionality simply because a simpler implementation is possible.

## 20.2 Work Phase by Phase

Before implementing a phase:

1. Read the relevant specification sections.
2. Inspect the existing new-project structure.
3. Identify dependencies.
4. Identify required changes.
5. Implement only the current phase.

After implementation:

1. Run the application.
2. Check the relevant functionality.
3. Run appropriate tests.
4. Fix identified errors.
5. Report the completed work.
6. Identify anything still incomplete.

Do not silently mark incomplete features as completed.

## 20.3 Avoid Unnecessary Complexity

- Prefer simple implementations.
- Avoid unnecessary libraries.
- Avoid duplicate functionality.
- Avoid overengineering.
- Reuse components where appropriate.
- Keep AI integration modular.
- Keep business logic readable.
- Avoid changing working code without a reason.

## 20.4 Error Prevention

Do not assume that code is working merely because it has been written.

Verify:

- Imports.
- Dependencies.
- API endpoints.
- Database connections.
- Environment variables.
- AI model configuration.
- Request/response structures.
- Frontend integration.

Do not leave known runtime errors unresolved.

## 20.5 Documentation

Maintain:

- README.md
- SPEC.md
- ARCHITECTURE.md
- API.md
- DATABASE.md
- DEVELOPMENT.md

Update documentation when an approved implementation decision changes.

## 20.6 Change Management

If a requirement needs to change:

1. Identify the affected specification section.
2. Explain why the change is needed.
3. Identify affected frontend/backend/database components.
4. Update the specification first.
5. Implement the approved change.
6. Verify that dependent functionality still works.

The specification must not become outdated relative to the implementation.

---

# 21. INITIAL IMPLEMENTATION PRIORITIES

The following order determines implementation priority.

| Priority | Component | Importance |
|---|---|---|
| P0 | Project setup | Critical |
| P0 | Authentication | Critical |
| P0 | Investigation generation | Critical |
| P0 | Suspects and culprit logic | Critical |
| P0 | Evidence generation and storage | Critical |
| P0 | Investigation interface | Critical |
| P0 | Culprit selection and results | Critical |
| P1 | WhatsApp-style presentation | High |
| P1 | Image evidence generation | High |
| P1 | CCTV generation and playback | High |
| P1 | Investigation history | High |
| P2 | Advanced UI polish | Normal |
| P2 | Additional evidence categories | Normal |

Priority determines development order, not permission to remove required functionality.

---

# 22. FINAL PRODUCT VISION

AI Mystery Room should provide a complete AI-generated detective experience.

The user is not simply answering a question with four options.

They are investigating a fictional incident using independently generated pieces of evidence, identifying relationships, discovering contradictions, and building a conclusion.

The AI creates the mystery.

The backend preserves the truth.

The user discovers the truth.

**Final development principle:**

Build a reliable, understandable, and maintainable mystery investigation platform first. Improve visual presentation without compromising the original investigation experience.

**END OF MASTER SPECIFICATION — VERSION 1.0**