/* Story: chapters, objectives, notes, endings */
(function (D) {
  'use strict';
  const has = (S, t) => S.inv.some(i => i.type === t);
  const note = (S, id) => S.notes.indexOf(id) >= 0;

  const NOTES = {
    n1: { title: 'Crumpled note', by: 'handwriting you almost recognise', text: "Don't stop moving.\nDon't look back.\n\nIf you are reading this you have already forgotten again. I'm sorry. I wrote this on the nightstand so you would find it first.\n\nThe light helps. The light always helps.\n\n- A." },
    n2: { title: 'Notice board', by: 'E. Voss, Caretaker', text: "MARLOWE COURT - RESIDENT NOTICE\n\nFire doors on floors 2 and 3 are to remain LOCKED after 10 PM. This is not a request.\n\nThe stairwell lock has been replaced. The spare key is held by the resident of Apartment 209 (Mrs. Okafor). Do not ask for it without good reason.\n\nBoiler maintenance is postponed again. Please stop calling the office about the smell." },
    n3: { title: 'Mrs. Okafor\'s diary', by: 'Apartment 209', text: "It was in the hallway again tonight. I swear it only moves when I blink.\n\nI stared at the wall at the end of the corridor for three hours. It never moved. The moment I looked down at my cup of tea it was standing at my door.\n\nI think it isn't trying to hurt us. I think it wants us to look at it.\n\nI left the stairwell key on the nightstand. If you can read this, take it and go. Go down. Don't look back."},
    n4: { title: 'Security log', by: 'A. Reyes, night watch', text: "03:12 - knocking from floor 2. Checked. Nothing.\n03:40 - knocking again. Closer.\n04:05 - smell of smoke from the basement. Called Voss. No answer.\n04:11 - the stairwell door was chained from the OUTSIDE. Who chains a door from the outside?\n04:20 - I can hear them. Dozens. Under the floor.\n\nI am going to the lobby. I am not going to look back." },
    n5: { title: 'Maintenance memo', by: 'E. Voss to Management', text: "RE: Boiler 2.\n\nPressure valve is failing. Replacement wheel ordered, not approved. Budget cut again.\n\nWe will NOT evacuate tenants over 'a bit of smoke'. The inspector can be handled. Lock the upper fire doors at night to avoid panic.\n\nKeep this quiet.\n\n(I took the valve wheel off the boiler myself. The thing is held together with luck.)" },
    n6: { title: 'A child\'s note', by: 'Tess, age 7', text: "mama says the numbers are the way out of the little room.\n\ni found them. i wrote them on the walls so i wont forget.\n\nthe mail room is first. then 102. then 105. and the washing room is last.\n\nthe quiet man in the hall only moves when we dont look. he is not mean. he is sad.\n\ni think he wants somebody to look at him." },
    n7: { title: 'Incident report', by: 'City Fire Department', text: "MARLOWE COURT - FIRE, 1 NOV 1994\n\nBoiler failure in the basement. Fire spread through the stairwell. Upper-floor fire doors found LOCKED and CHAINED from the stairwell side.\n\n23 residents died on floors 2 and 3.\n\nSurviving staff on site: ONE. The night watchman, A. Reyes, who left through the main lobby. He has declined to give a statement." },
    n8: { title: 'Statement of A. Reyes', by: 'never filed', text: "I heard them. All of them. Through the doors.\n\nI was standing at the fire door with the key in my hand. The key. I could have opened it.\n\nI looked at the front door instead. I looked at the street. I walked out and I did not turn around. Not once.\n\nI have been walking out ever since." },
    n9: { title: 'The last page', by: 'A. Reyes (you)', text: "The building doesn't hold them. It holds ME.\n\nThey are not hunting. They only move when I'm not looking because I never looked. That's all they want. For me to turn around and see them.\n\nEvery time I run, it starts over. The apartment. The nightstand. The note.\n\nThere is a brass key on this desk. It opens the front door. It opens other things too.\n\nYou have three choices. You know what they are." }
  };

  const CHAPTERS = [
    {
      n: 1, title: 'THE AWAKENING', sub: 'You wake in a building you do not know.',
      obj: [
        { id: 'flash', text: 'Find a light source in the dark', done: S => !!S.flags.has_flash },
        { id: 'leave', text: 'Leave Apartment 204', done: S => !!S.flags.left_apt },
        { id: 'key', text: 'Find the stairwell key (Apartment 209)', done: S => has(S, 'key_stair') || S.unlocked.indexOf('stair2') >= 0 },
        { id: 'down', text: 'Take the stairs down', done: S => !!S.flags.reached_f1 }
      ]
    },
    {
      n: 2, title: 'SOMETHING IS FOLLOWING', sub: 'It only moves when you are not looking at it.',
      obj: [
        { id: 'fuse', text: 'Find the missing fuse (check the Laundry)', done: S => has(S, 'fuse') || !!S.flags.power },
        { id: 'power', text: 'Restore power in the Fuse Room', done: S => !!S.flags.power },
        { id: 'elev', text: 'Call the elevator in the lobby', done: S => !!S.flags.used_elevator }
      ]
    },
    {
      n: 3, title: 'THE BUILDING CHANGES', sub: 'The walls are remembering.',
      obj: [
        { id: 'nums', text: 'Find the four scratched numbers (4 rooms)', done: S => S.digits.length >= 4 },
        { id: 'safe', text: 'Open the safe in Apartment 104', done: S => !!S.flags.safe_open },
        { id: 'office', text: "Unlock the Caretaker's Office", done: S => !!S.flags.office_open },
        { id: 'card', text: 'Take the basement keycard', done: S => has(S, 'key_basement') || !!S.flags.reached_b }
      ]
    },
    {
      n: 4, title: 'THE TRUTH', sub: 'Marlowe Court. November 1994.',
      obj: [
        { id: 'base', text: 'Go down to the basement', done: S => !!S.flags.reached_b },
        { id: 'red', text: 'Find the red archive key (Boiler Room)', done: S => has(S, 'key_archive') || !!S.flags.archive_open },
        { id: 'arch', text: 'Unlock the Archive', done: S => !!S.flags.archive_open },
        { id: 'read', text: 'Read all three archive files', done: S => note(S, 'n7') && note(S, 'n8') && note(S, 'n9') }
      ]
    },
    {
      n: 5, title: "DON'T LOOK BEHIND YOU", sub: 'Get out.',
      obj: [
        { id: 'brass', text: 'Take the brass key from the Archive desk', done: S => has(S, 'key_exit') || !!S.flags.ending },
        { id: 'out', text: 'Reach the front door in the lobby', done: S => !!S.flags.ending }
      ]
    }
  ];

  const ENDINGS = {
    run: { title: 'THE LOOP', text: "You push the door open and step into the cold night air. The street is silent. You walk. You do not turn around.\n\nBehind you, the building sighs, almost kindly.\n\nThen the street is a corridor. The corridor is a room. There is a nightstand. A light. A note in your own handwriting.\n\nDon't stop moving. Don't look back." },
    look: { title: 'RELEASE', text: "You turn around.\n\nIt stops an arm's length from your face. Up close it is not one thing. It is twenty-three of them, standing so quietly that they became a shape.\n\nYou say their names. You did not know you remembered them.\n\nOne by one they put a hand to the glass of the door and the glass is warm. The chains fall. The fire doors open. Somewhere above you, for the first time in thirty years, the sun comes up." },
    ash: { title: 'ASHES', text: "The boiler screams. The old building lights up like a lantern, window by window, and for one long moment you can see them all, standing at every glass, watching you go.\n\nYou are on the pavement when the roof comes down. You do not turn around.\n\nThe fire burns until morning. By noon there is nothing left but a chimney and a quiet that sits on the street like a hand.\n\nSome things should be buried. Some things should burn. You hope you chose right." }
  };

  D.Story = {
    notes: NOTES, chapters: CHAPTERS, endings: ENDINGS,
    chapter(S) { return CHAPTERS[Math.min(S.chapter, CHAPTERS.length) - 1]; },
    objective(S) { const c = D.Story.chapter(S); return c.obj.find(o => !o.done(S)) || null; },
    // returns array of newly completed objective ids; advances chapter when finished
    check(S) {
      const c = D.Story.chapter(S), res = { done: [], advanced: false };
      c.obj.forEach(o => { const d = o.done(S); if (d && S.objDone.indexOf(c.n + ':' + o.id) < 0) { S.objDone.push(c.n + ':' + o.id); res.done.push(o); } });
      if (!D.Story.objective(S) && S.chapter < CHAPTERS.length) { S.chapter++; res.advanced = true; }
      return res;
    },
    notesRead(S) { return S.notes.length; },
    totalNotes: Object.keys(NOTES).length
  };
})(window.DLBY);
