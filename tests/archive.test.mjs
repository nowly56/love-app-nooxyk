import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { createLocalArchive } from "../src/web/storage.ts";
import { defaultPreferences } from "../src/web/models.ts";
import { daysTogether, validDate, todayLocal } from "../src/web/dates.ts";
import { parseBackup } from "../src/web/backup.ts";

test("calendar days include leap day and ignore daylight-saving shifts", () => {
  assert.equal(daysTogether("2024-02-28", "2024-03-01"), 2);
  assert.equal(daysTogether("2024-03-30", "2024-04-01"), 2);
  assert.equal(daysTogether("2024-01-01", "2024-01-01"), 0);
  assert.equal(daysTogether("2024-01-02", "2024-01-01"), 0);
  assert.equal(validDate("2023-02-29"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(validDate("2099-01-01"), false);
  assert.equal(validDate("2024-13-01"), false);
  assert.equal(validDate(""), false);
  assert.equal(todayLocal(new Date(2024, 0, 2, 23)), "2024-01-02");
});

test("archive persists blobs and edits, isolates profiles, and deletes only the selected moment", async () => {
  const first = createLocalArchive("test-first");
  const second = createLocalArchive("test-second");
  await first.savePreferences({
    ...defaultPreferences,
    name: "Тест",
    startDate: "2024-02-29",
    theme: "dark",
  });
  const moment = {
    id: "same-id",
    caption: "Первый момент",
    date: "2024-02-29",
    photo: new Blob(["test-photo"], { type: "image/jpeg" }),
    favorite: false,
  };
  await first.saveMoment(moment);
  await second.saveMoment({ ...moment, caption: "Другой профиль" });
  const reopened = createLocalArchive("test-first");
  assert.equal((await reopened.preferences()).theme, "dark");
  assert.equal((await second.preferences()).name, "");
  assert.equal(await (await reopened.moments())[0].photo.text(), "test-photo");
  await reopened.saveMoment({
    ...moment,
    favorite: true,
    caption: "Новая подпись",
  });
  assert.equal((await first.moments()).length, 1);
  assert.equal((await first.moments())[0].favorite, true);
  assert.equal((await second.moments())[0].caption, "Другой профиль");
  await first.deleteMoment(moment.id);
  assert.equal((await reopened.moments()).length, 0);
  assert.equal((await second.moments()).length, 1);
});

test("backup parser accepts the exported shape and rejects unsupported or damaged archives", () => {
  const valid = {
    version: 1,
    preferences: {
      ...defaultPreferences,
      name: "Тест",
      startDate: "2024-02-29",
    },
    moments: [
      {
        id: "memory-1",
        date: "2024-03-01",
        caption: "Фото",
        favorite: true,
        photo: "data:image/jpeg;base64,/9j/AA==",
      },
    ],
  };
  const restored = parseBackup(valid, todayLocal());
  assert.equal(restored.moments[0].photo.type, "image/jpeg");
  assert.equal(restored.moments[0].favorite, true);
  assert.throws(
    () => parseBackup({ ...valid, version: 2 }, todayLocal()),
    /не поддерживается/,
  );
  assert.throws(
    () =>
      parseBackup(
        {
          ...valid,
          moments: [
            { ...valid.moments[0], photo: "data:image/jpeg;base64,SGVsbG8=" },
          ],
        },
        todayLocal(),
      ),
    /формату/,
  );
  assert.throws(
    () =>
      parseBackup(
        { ...valid, moments: [{ ...valid.moments[0], date: "2099-01-01" }] },
        todayLocal(),
      ),
    /неверная дата/,
  );
  assert.throws(
    () =>
      parseBackup(
        { ...valid, moments: [valid.moments[0], valid.moments[0]] },
        todayLocal(),
      ),
    /повторяющийся/,
  );
});

test("the previous web build's saved relationship date is migrated into the local archive", async () => {
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (key === "user_start_date" ? "2024-02-29" : null),
  };
  try {
    const preferences = await createLocalArchive("browser").preferences();
    assert.equal(preferences.startDate, "2024-02-29");
    globalThis.localStorage = { getItem: () => "2099-02-29" };
    assert.equal(
      (await createLocalArchive("browser-invalid-date").preferences())
        .startDate,
      "",
    );
  } finally {
    if (oldStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = oldStorage;
  }
});

test("archive restore merges imported moments atomically without removing existing moments", async () => {
  const store = createLocalArchive("test-restore");
  const existing = {
    id: "old",
    date: "2024-01-01",
    caption: "Оставить",
    favorite: false,
    photo: new Blob(["old"]),
  };
  const imported = {
    id: "new",
    date: "2024-02-01",
    caption: "Импорт",
    favorite: true,
    photo: new Blob(["new"]),
  };
  await store.saveMoment(existing);
  await store.restoreArchive(
    { ...defaultPreferences, name: "Из копии", startDate: "2024-01-01" },
    [imported],
  );
  assert.equal((await store.preferences()).name, "Из копии");
  assert.deepEqual((await store.moments()).map(({ id }) => id).sort(), [
    "new",
    "old",
  ]);
  assert.equal(
    await (await store.moments()).find(({ id }) => id === "new").photo.text(),
    "new",
  );
});
