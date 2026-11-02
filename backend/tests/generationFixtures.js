export const suspect = (suspectId, name) => ({
  suspectId, name, age: 35, occupation: 'Archivist', biography: 'A long-serving member of the archive team.',
  relationshipToIncident: 'Had access to the archive.', motive: 'A disputed collection decision.',
  alibi: 'Says they were in the reading room.', background: 'They know the building well.',
});

export function blueprint() {
  return {
    case: {
      title: 'The Vanishing Ledger', description: 'A ledger disappeared from a locked archive.',
      incidentSummary: 'A priceless ledger vanished during a private reception.', affectedPerson: 'Mara Voss',
      location: 'North Archive', incidentDateTime: '2026-10-31T20:00:00.000Z', background: 'The archive was closed to the public.',
    },
    incidentDetails: { whatHappened: 'The ledger was removed.', howItOccurred: 'A service passage was used.', possibleMotives: ['Debt', 'Revenge'] },
    suspects: [suspect('S1', 'Ada Vale'), suspect('S2', 'Bram Cole'), suspect('S3', 'Cleo Shaw')],
    timeline: [0, 1, 2, 3].map((n) => ({
      eventId: `T${n + 1}`, occurredAt: `2026-10-31T${String(18 + n).padStart(2, '0')}:00:00.000Z`,
      description: `Archive event ${n + 1}.`, suspectIds: [n === 2 ? 'S1' : 'S2'],
    })),
    clues: [
      { clueId: 'C1', description: 'A copied key was used.', classification: 'supporting', explanation: 'Ada held the copied key.', suspectIds: ['S1'] },
      { clueId: 'C2', description: 'The clock was reset.', classification: 'contradictory', explanation: 'The time stamp conflicts with the alibi.', suspectIds: ['S2'] },
      { clueId: 'C3', description: 'Ink appeared on a glove.', classification: 'misleading', explanation: 'The ink came from restoration work.', suspectIds: ['S3'] },
      { clueId: 'C4', description: 'A service door was opened.', classification: 'supporting', explanation: 'Ada had access to the passage.', suspectIds: ['S1'] },
    ],
    solution: {
      culpritSuspectId: 'S1', crimeExplanation: 'Ada used the copied key and service passage.',
      actualSequenceOfEvents: ['Ada copied the key.', 'Ada entered the passage.', 'Ada removed the ledger.'],
      supportingClueIds: ['C1', 'C4'],
      misleadingClueExplanations: [{ clueId: 'C3', explanation: 'Restoration ink transferred during routine work.' }],
      finalExplanation: 'The key record and door sensor place Ada at the archive.',
    },
  };
}

export function evidencePlan() {
  const mk = (evidenceId, type, clueId, reliability) => ({
    evidenceId, type, title: `${type} ${evidenceId}`, description: 'A record connected to the archive incident.',
    timestamp: '2026-10-31T20:00:00.000Z', associatedSuspectIds: ['S1'], clueIds: [clueId], reliability,
    internalPurpose: 'Connect the record to the stated clue.', conversationId: type === 'chat' ? evidenceId : '',
    messages: type === 'chat' ? [0, 1, 2].map((n) => ({ sender: 'Ada Vale', receiver: 'Bram Cole', text: `Message ${n + 1}.`, timestamp: `2026-10-31T19:0${n}:00.000Z` })) : [],
    imagePrompt: type === 'image' ? 'A detailed fictional archive desk with a copied brass key.' : '',
    cameraLocation: type === 'cctv' ? 'North Archive entrance camera' : '',
    durationSeconds: type === 'cctv' ? 8 : 0,
    videoPrompt: type === 'cctv' ? 'A continuous fictional CCTV view of a person entering an archive.' : '',
  });
  return { evidence: [
    mk('E1', 'chat', 'C1', 'supporting'), mk('E2', 'chat', 'C3', 'misleading'),
    mk('E3', 'image', 'C2', 'contradictory'), mk('E4', 'image', 'C4', 'supporting'),
    mk('E5', 'cctv', 'C1', 'supporting'),
  ] };
}
