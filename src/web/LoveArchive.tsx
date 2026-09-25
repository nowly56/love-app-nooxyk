import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { compressPhoto } from "./storage";
import { defaultPreferences, type Moment, type Preferences } from "./models";
import { createArchiveRepository, type ArchiveRepository } from "./repository";
import { daysTogether, displayDate, todayLocal, validDate } from "./dates";
import { readBackup } from "./backup";
import { Avatar, Icon, Photo, Sheet } from "./components";
import { useTelegramEnvironment } from "./useTelegramEnvironment";
import "./styles.css";

type Tab = "home" | "moments" | "settings";
type Panel = "date" | "partner" | "help" | "editor" | null;

export default function LoveArchive() {
  const { telegram, telegramLoading } = useTelegramEnvironment();
  const [repository, setRepository] = useState<ArchiveRepository | null>(null);
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [panel, setPanel] = useState<Panel>(null);
  const [date, setDate] = useState(todayLocal());
  const [invite, setInvite] = useState("");
  const [draft, setDraft] = useState<Moment | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [today, setToday] = useState(todayLocal());
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const preferenceRef = useRef(preferences);
  const preferenceQueue = useRef(Promise.resolve());

  useEffect(() => {
    if (telegramLoading) return;
    document.title = "Love Archive — ваша история";
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        const active = telegram;
        // Telegram identity is display/local partitioning only, never authorization.
        const store = createArchiveRepository(
          active?.initDataUnsafe.user
            ? `telegram:${active.initDataUnsafe.user.id}`
            : "browser",
        );
        const [saved, photos] = await Promise.all([
          store.preferences(),
          store.moments(),
        ]);
        if (cancelled) return;
        setRepository(store);
        setPreferences(saved);
        preferenceRef.current = saved;
        setDate(saved.startDate || todayLocal());
        setMoments(photos);
        const start =
          active?.initDataUnsafe.start_param ||
          new URLSearchParams(location.search).get("invite");
        if (start) {
          setInvite(start.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64));
          setPanel("partner");
        }
      } catch {
        if (!cancelled)
          setBootError(
            "Не удалось открыть локальный архив. Разрешите хранение данных для этого сайта и повторите попытку.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [telegram, telegramLoading]);
  useEffect(() => {
    if (telegram?.isVersionAtLeast("6.1")) {
      telegram.setBackgroundColor("#f7f2eb");
      if (telegram.isVersionAtLeast("6.9")) telegram.setHeaderColor("#f7f2eb");
    }
  }, [telegram]);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayLocal()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const originalMoment = draft ? moments.find((m) => m.id === draft.id) : null;
  const hasUnsavedMoment =
    !!draft &&
    (!originalMoment ||
      originalMoment.caption !== draft.caption ||
      originalMoment.date !== draft.date ||
      originalMoment.favorite !== draft.favorite);
  const close = useCallback(() => {
    if (saving.current) return;
    if (
      hasUnsavedMoment &&
      !window.confirm("Закрыть момент? Несохранённые изменения будут потеряны.")
    )
      return;
    setPanel(null);
    setDraft(null);
    setError("");
    setConfirmDelete(false);
  }, [hasUnsavedMoment]);
  useEffect(() => {
    if (!telegram?.isVersionAtLeast("6.1")) return;
    const back = () => (panel ? close() : setTab("home"));
    if (panel || tab !== "home") telegram.BackButton.show();
    else telegram.BackButton.hide();
    telegram.BackButton.onClick(back);
    return () => {
      telegram.BackButton.offClick(back);
      telegram.BackButton.hide();
    };
  }, [telegram, panel, tab, close]);
  useEffect(() => {
    if (!hasUnsavedMoment) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedMoment]);

  const perform = async (action: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить. Проверьте свободное место и повторите.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const savePreferences = (patch: Partial<Preferences>) => {
    const task = preferenceQueue.current.then(async () => {
      if (!repository) throw new Error("Архив ещё не открыт.");
      const next = { ...preferenceRef.current, ...patch };
      await repository.savePreferences(next);
      preferenceRef.current = next;
      setPreferences(next);
    });
    preferenceQueue.current = task.catch(() => {});
    return task;
  };
  const saveDate = () =>
    perform(async () => {
      if (!validDate(date))
        throw new Error(
          "Выберите существующую дату от 1900 года до сегодняшнего дня.",
        );
      await savePreferences({ startDate: date });
      setPanel(null);
      setMessage("Начало вашей истории сохранено");
    });
  const changeTab = (value: Tab) => {
    setTab(value);
    setError("");
    if (preferences.haptics && telegram?.isVersionAtLeast("6.1"))
      telegram.HapticFeedback?.selectionChanged();
  };
  const choosePhoto = (file?: File) => {
    if (!file) return;
    void perform(async () => {
      const photo = await compressPhoto(file);
      setDraft({
        id: crypto.randomUUID(),
        date: todayLocal(),
        caption: "",
        photo,
        favorite: false,
      });
      setPanel("editor");
    });
  };
  const saveMoment = () =>
    perform(async () => {
      if (!draft || !repository) return;
      if (!validDate(draft.date))
        throw new Error(
          "Проверьте дату момента. Она не должна быть в будущем.",
        );
      const next = { ...draft, caption: draft.caption.trim() };
      await repository.saveMoment(next);
      setMoments((items) =>
        [next, ...items.filter((m) => m.id !== next.id)].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
      setDraft(null);
      setPanel(null);
      setTab("moments");
      setMessage("Момент сохранён");
    });
  const removeMoment = () =>
    perform(async () => {
      if (!draft || !repository) return;
      await repository.deleteMoment(draft.id);
      setMoments((items) => items.filter((m) => m.id !== draft.id));
      setDraft(null);
      setPanel(null);
      setConfirmDelete(false);
      setMessage("Момент удалён с этого устройства");
    });
  const exportArchive = () =>
    perform(async () => {
      const totalPhotoBytes = moments.reduce(
        (size, moment) => size + moment.photo.size,
        0,
      );
      if (totalPhotoBytes > 140 * 1024 * 1024)
        throw new Error(
          "Эта копия слишком большая для подготовки в браузере. Скачайте фотографии по частям позже.",
        );
      const photos = await Promise.all(
        moments.map(async (moment) => ({
          ...moment,
          photo: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(moment.photo);
          }),
        })),
      );
      const blob = new Blob(
        [JSON.stringify({ version: 1, preferences, moments: photos }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `love-archive-${today}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("Архив подготовлен для скачивания");
    });
  const importArchive = (file?: File) => {
    if (!file) return;
    void perform(async () => {
      if (!repository) throw new Error("Архив ещё не открыт.");
      const backup = await readBackup(file, today);
      if (
        !window.confirm(
          `Добавить ${backup.moments.length} моментов и восстановить дату и настройки из этой копии? Существующие моменты с такими же идентификаторами обновятся.`,
        )
      )
        return;
      await repository.restoreArchive(backup.preferences, backup.moments);
      const restored = new Map(moments.map((moment) => [moment.id, moment]));
      backup.moments.forEach((moment) => restored.set(moment.id, moment));
      const nextMoments = [...restored.values()].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      preferenceRef.current = backup.preferences;
      setPreferences(backup.preferences);
      setDate(backup.preferences.startDate || today);
      setMoments(nextMoments);
      setMessage(`Архив восстановлен · ${backup.moments.length} моментов`);
    });
  };

  const filtered = useMemo(
    () =>
      moments.filter(
        (m) =>
          (!favorites || m.favorite) &&
          `${m.caption} ${displayDate(m.date)}`
            .toLocaleLowerCase("ru")
            .includes(search.toLocaleLowerCase("ru")),
      ),
    [moments, search, favorites],
  );
  const groups = useMemo(() => {
    const result = new Map<string, Moment[]>();
    filtered.forEach((m) => {
      const month = m.date.slice(0, 7);
      result.set(month, [...(result.get(month) ?? []), m]);
    });
    return [...result];
  }, [filtered]);
  const name =
    preferences.name || telegram?.initDataUnsafe.user?.first_name || "Вы";
  const profilePhotoUrl = telegram?.initDataUnsafe.user?.photo_url;
  const days = preferences.startDate
    ? daysTogether(preferences.startDate, today)
    : 0;
  const milestone = (Math.floor(days / 50) + 1) * 50;
  const progress = (days % 50) * 2;

  if (loading || bootError)
    return (
      <main className="boot">
        <div className="brand-mark">♡</div>
        <h1>Love Archive</h1>
        <p role={bootError ? "alert" : "status"}>
          {bootError || "Открываем вашу историю…"}
        </p>
        {bootError && (
          <button className="primary" onClick={() => location.reload()}>
            Повторить
          </button>
        )}
      </main>
    );

  return (
    <div className="archive-app">
      <header className="app-header">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            changeTab("home");
          }}
        >
          <span className="brand-mark">♡</span>
          <span>
            love archive<small>МАЛЕНЬКАЯ ИСТОРИЯ БОЛЬШОЙ ЛЮБВИ</small>
          </span>
        </a>
        <Avatar name={name} photoUrl={profilePhotoUrl} />
      </header>
      {!panel && error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Закрыть ошибку">
            ×
          </button>
        </div>
      )}
      <main className="main-content">
        {!preferences.startDate ? (
          <section className="onboarding">
            <span className="eyebrow">ГЛАВА 01 / НАЧАЛО</span>
            <div className="onboarding-heart">♡</div>
            <h1>
              У каждой любви
              <br />
              есть <em>первый день.</em>
            </h1>
            <p>
              Выберите дату, с которой началась ваша история. Мы сохраним каждый
              тёплый момент.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveDate();
              }}
            >
              <label htmlFor="start-date">Когда всё началось?</label>
              <input
                id="start-date"
                type="date"
                min="1900-01-01"
                max={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
              <div className="quick-dates">
                <button
                  type="button"
                  className="chip"
                  onClick={() => setDate(today)}
                >
                  Сегодня
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setDate(todayLocal(yesterday));
                  }}
                >
                  Вчера
                </button>
              </div>
              <button className="primary full" disabled={busy}>
                Начать нашу историю <Icon name="arrow" />
              </button>
            </form>
            <button className="text-button" onClick={() => setPanel("partner")}>
              У меня есть код партнёра
            </button>
            <p className="local-note">
              Ваш архив пока хранится только на этом устройстве.
            </p>
          </section>
        ) : (
          <>
            {tab === "home" && (
              <section className="home-screen">
                <div className="section-top">
                  <span className="eyebrow">ВАША ОБЩАЯ ИСТОРИЯ</span>
                  <button className="chip" onClick={() => setPanel("partner")}>
                    <span className="status-dot" />
                    Пригласить партнёра <span aria-hidden="true">↗</span>
                  </button>
                </div>
                <div className="day-counter">
                  <span className="tiny-heart">♡</span>
                  <h1>{days.toLocaleString("ru-RU")}</h1>
                  <span className="eyebrow">ДНЕЙ ЛЮБВИ</span>
                  <p>С {displayDate(preferences.startDate)}</p>
                </div>
                <article className="milestone card">
                  <div className="card-top">
                    <span className="eyebrow">
                      СЛЕДУЮЩАЯ МАЛЕНЬКАЯ ВЕЧНОСТЬ
                    </span>
                    <Icon name="star" />
                  </div>
                  <h2>
                    {milestone} <em>дней вместе</em>
                  </h2>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label="До следующего юбилея"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="card-bottom">
                    <span>Ещё {milestone - days} дн. до новой главы</span>
                    <span>{progress}%</span>
                  </div>
                </article>
                <div className="section-title">
                  <h2>То, что хочется помнить</h2>
                  <button
                    className="text-button"
                    onClick={() => changeTab("moments")}
                  >
                    Все моменты <span aria-hidden="true">↗</span>
                  </button>
                </div>
                {moments.length ? (
                  <div className="recent-grid">
                    {moments.slice(0, 2).map((m) => (
                      <button
                        className="moment-card"
                        key={m.id}
                        onClick={() => {
                          setDraft(m);
                          setPanel("editor");
                        }}
                      >
                        <Photo
                          photo={m.photo}
                          alt={m.caption || "Ваш момент"}
                        />
                        <span className="moment-caption">
                          {m.caption || displayDate(m.date)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    className="empty-card"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                  >
                    <span className="empty-icon">
                      <Icon name="photos" size={28} />
                    </span>
                    <strong>Ваш первый момент</strong>
                    <span>
                      Фото, улыбка, обычный вторник.
                      <br />
                      Всё, что делает вас ближе.
                    </span>
                    <span className="text-button">Добавить фотографию +</span>
                  </button>
                )}
                <p className="local-note">
                  Только на этом устройстве · {moments.length} моментов
                </p>
              </section>
            )}
            {tab === "moments" && (
              <section>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">СОБИРАЕМ САМОЕ ДОРОГОЕ</span>
                    <h1>Моменты</h1>
                  </div>
                  <button
                    className="round-button"
                    aria-label="Добавить момент"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                  >
                    <Icon name="plus" />
                  </button>
                </div>
                <div className="filters">
                  <input
                    type="search"
                    aria-label="Поиск моментов"
                    placeholder="Найти тёплое воспоминание…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    className={`chip ${favorites ? "active" : ""}`}
                    aria-pressed={favorites}
                    onClick={() => setFavorites(!favorites)}
                  >
                    <Icon name="heart" size={17} />
                    Избранное
                  </button>
                </div>
                {groups.length === 0 && (
                  <div className="empty-card">
                    <span className="empty-icon">
                      <Icon name="photos" size={32} />
                    </span>
                    <h2>
                      {moments.length
                        ? "Ничего не нашлось"
                        : "Здесь будет ваша история"}
                    </h2>
                    <p>
                      {moments.length
                        ? "Попробуйте другой запрос или уберите фильтр."
                        : "Добавьте первое фото. Большие истории начинаются с маленьких моментов."}
                    </p>
                    {moments.length ? (
                      <button
                        className="secondary"
                        onClick={() => {
                          setSearch("");
                          setFavorites(false);
                        }}
                      >
                        Сбросить фильтры
                      </button>
                    ) : (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                      >
                        Добавить момент
                      </button>
                    )}
                  </div>
                )}
                {groups.map(([month, items]) => (
                  <section key={month} className="month-section">
                    <h2>
                      {new Date(`${month}-01T12:00:00`).toLocaleDateString(
                        "ru-RU",
                        { month: "long", year: "numeric" },
                      )}
                      <span>{items.length}</span>
                    </h2>
                    <div className="moments-grid">
                      {items.map((m) => (
                        <button
                          className="moment-card"
                          key={m.id}
                          onClick={() => {
                            setDraft(m);
                            setPanel("editor");
                            setConfirmDelete(false);
                          }}
                        >
                          <Photo
                            photo={m.photo}
                            alt={m.caption || `Момент ${displayDate(m.date)}`}
                          />
                          <span className="moment-caption">
                            {m.caption || "Маленькое счастье"}
                            <small>
                              {displayDate(m.date)} {m.favorite ? "♥" : ""}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </section>
            )}
            {tab === "settings" && (
              <section>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">ВАШЕ ЛИЧНОЕ ПРОСТРАНСТВО</span>
                    <h1>Настройки</h1>
                  </div>
                </div>
                <div className="profile-card card">
                  <Avatar name={name} photoUrl={profilePhotoUrl} large />
                  <div>
                    <h2>{name}</h2>
                    <p>{telegram ? "Профиль Telegram" : "Локальный профиль"}</p>
                    <span className="muted">Партнёр пока не подключён</span>
                  </div>
                </div>
                <div className="settings-group">
                  <span className="eyebrow">ВАША ИСТОРИЯ</span>
                  <form
                    className="name-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const value = new FormData(e.currentTarget).get("name");
                      void perform(async () => {
                        await savePreferences({
                          name: String(value ?? "")
                            .trim()
                            .slice(0, 40),
                        });
                        setMessage("Имя сохранено");
                      });
                    }}
                  >
                    <label htmlFor="profile-name">Как вас называть?</label>
                    <div>
                      <input
                        id="profile-name"
                        name="name"
                        defaultValue={name === "Вы" ? "" : name}
                        maxLength={40}
                        placeholder="Ваше имя"
                      />
                      <button className="secondary" disabled={busy}>
                        Сохранить
                      </button>
                    </div>
                  </form>
                  <button
                    className="setting-row"
                    onClick={() => {
                      setDate(preferences.startDate);
                      setPanel("date");
                    }}
                  >
                    <span>
                      Начало истории
                      <small>{displayDate(preferences.startDate)}</small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                  <button
                    className="setting-row"
                    onClick={() => setPanel("partner")}
                  >
                    <span>
                      Связь с партнёром<small>Скоро</small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
                <div className="settings-group">
                  <span className="eyebrow">ПРИЛОЖЕНИЕ</span>
                  <label className="setting-row" htmlFor="haptics">
                    <span>
                      Тактильный отклик
                      <small>
                        {telegram
                          ? "При переключении разделов"
                          : "Работает внутри Telegram"}
                      </small>
                    </span>
                    <input
                      id="haptics"
                      type="checkbox"
                      role="switch"
                      checked={preferences.haptics}
                      disabled={busy}
                      onChange={(e) => {
                        const haptics = e.target.checked;
                        void perform(() => savePreferences({ haptics }));
                      }}
                    />
                  </label>
                </div>
                <div className="settings-group">
                  <span className="eyebrow">ВАШИ ДАННЫЕ</span>
                  <button
                    className="setting-row"
                    onClick={exportArchive}
                    disabled={busy}
                  >
                    <span>
                      Скачать архив
                      <small>Даты, подписи и фотографии в JSON</small>
                    </span>
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button
                    className="setting-row"
                    onClick={() => backupInput.current?.click()}
                    disabled={busy}
                  >
                    <span>
                      Восстановить архив
                      <small>
                        Добавить фото и вернуть настройки из JSON-копии
                      </small>
                    </span>
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    className="setting-row"
                    onClick={() => setPanel("help")}
                  >
                    <span>Помощь и хранение данных</span>
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
                <p className="local-note">
                  Love Archive · 1.0
                  <br />
                  Сделано для ваших маленьких вечностей.
                </p>
              </section>
            )}
          </>
        )}
      </main>
      {preferences.startDate && (
        <nav className="bottom-nav" aria-label="Основная навигация">
          <div className="tabs">
            {(
              [
                { id: "home", title: "Главная", icon: "heart" },
                { id: "moments", title: "Моменты", icon: "photos" },
                { id: "settings", title: "Настройки", icon: "settings" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-current={tab === item.id ? "page" : undefined}
                className={tab === item.id ? "selected" : ""}
                onClick={() => changeTab(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.title}</span>
                <i />
              </button>
            ))}
          </div>
          <button
            className="camera-button"
            aria-label="Сделать фото"
            disabled={busy}
            onClick={() => cameraInput.current?.click()}
          >
            <Icon name="camera" size={26} />
          </button>
        </nav>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        hidden
        onChange={(e) => {
          choosePhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          choosePhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={backupInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          importArchive(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {panel && (
        <Sheet
          title={
            {
              date: "Первый день вашей истории",
              partner: "Ближе друг к другу",
              help: "О вашем архиве",
              editor: "Ваш тёплый момент",
            }[panel]
          }
          close={close}
        >
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          {panel === "date" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveDate();
              }}
            >
              <label htmlFor="edit-date">Дата начала отношений</label>
              <input
                id="edit-date"
                type="date"
                min="1900-01-01"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <p className="muted">Счётчик обновится сразу после сохранения.</p>
              <button className="primary full" disabled={busy}>
                Сохранить дату
              </button>
            </form>
          )}
          {panel === "partner" && (
            <div className="partner-panel">
              <div className="partner-hearts">
                ♡<span>♡</span>
              </div>
              <h3>Одна история. На двоих.</h3>
              <p>
                Скоро здесь можно будет объединить ваши архивы, обмениваться
                фотографиями и отмечать общие даты.
              </p>
              {invite && (
                <div className="invite-received">
                  <span className="eyebrow">КОД ИЗ ПРИГЛАШЕНИЯ</span>
                  <strong>{invite}</strong>
                </div>
              )}
              <div className="notice">
                Подключение партнёра пока недоступно. Сейчас фотографии и
                настройки сохраняются только на вашем устройстве.
              </div>
              <button className="primary full" onClick={close}>
                Продолжить свою историю
              </button>
            </div>
          )}
          {panel === "help" && (
            <div className="help-copy">
              <h3>Что уже можно делать?</h3>
              <p>
                Считать дни вместе, добавлять фото из галереи или камеры,
                редактировать подписи и даты, отмечать любимые моменты и менять
                оформление.
              </p>
              <h3>Где хранятся фотографии?</h3>
              <p>
                В памяти браузера на этом устройстве. Очистка данных сайта
                удалит архив. В другом браузере или на другом телефоне он не
                появится. Сохраните копию через «Скачать архив».
              </p>
              <h3>А совместный архив?</h3>
              <p>
                Связь с партнёром, синхронизация и уведомления появятся позже.
                Фото сейчас никому не отправляются.
              </p>
              <h3>Камера не открывается?</h3>
              <p>
                Разрешите доступ к камере в настройках Telegram или браузера. На
                компьютере и в некоторых клиентах откроется выбор файла — можно
                добавить готовое фото.
              </p>
            </div>
          )}
          {panel === "editor" && draft && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMoment();
              }}
            >
              <Photo
                photo={draft.photo}
                alt={draft.caption || "Предпросмотр момента"}
                className="editor-photo"
              />
              <label htmlFor="caption">Что хочется запомнить?</label>
              <textarea
                id="caption"
                maxLength={500}
                rows={3}
                placeholder="Тот самый день, когда…"
                value={draft.caption}
                onChange={(e) =>
                  setDraft({ ...draft, caption: e.target.value })
                }
              />
              <span className="char-count">{draft.caption.length}/500</span>
              <label htmlFor="moment-date">Дата момента</label>
              <input
                id="moment-date"
                type="date"
                min="1900-01-01"
                max={today}
                required
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
              <label className="favorite-check">
                <input
                  type="checkbox"
                  checked={draft.favorite}
                  onChange={(e) =>
                    setDraft({ ...draft, favorite: e.target.checked })
                  }
                />
                В избранное ♡
              </label>
              <button className="primary full" disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить момент"}
              </button>
              {moments.some((m) => m.id === draft.id) &&
                (confirmDelete ? (
                  <div className="delete-confirm">
                    <p>
                      Удалить фото и подпись с этого устройства? Отменить это
                      действие нельзя.
                    </p>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={busy}
                      onClick={removeMoment}
                    >
                      Да, удалить момент
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Оставить
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Удалить момент
                  </button>
                ))}
            </form>
          )}
        </Sheet>
      )}
      <div
        className={`toast ${message || busy ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {busy ? "Секунду, сохраняем…" : message}
      </div>
    </div>
  );
}
