<!-- Meeting location
location
Participants
participants
Action items
action_items
Department
department -->

<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { goto } from "$app/navigation";

    type CalendarEventPrefillResponse = {
        event?: {
            id: number;
            title: string;
            startTime: string;
        };
        error?: string;
    };

    type MeetingOption = "" | "Ya" | "Tidak";
    const alasanTidakMeeting = [
        { value: "lupa", label: "Lupa" },
        {
            value: "tidak-tahu",
            label: "Tidak mengetahui program ini dan takut salah",
        },
        { value: "lainnya", label: "Other" },
    ];

    interface FormValues {
        employeeId: string;
        namaPegawai: string;
        tanggalMeeting: string;
        judulMeeting: string;
        deskripsiMeeting: string;
        fotoMeeting: File | null;
        melaksanakanMeeting: MeetingOption;
        alasanTidakMeeting: string;
        alasanLainnya: string;
    }

    type FieldName = keyof FormValues;
    type FormErrors = Partial<Record<FieldName, string>>;
    type Notice = {
        type: "success" | "error" | "info";
        title: string;
        description?: string;
    };

    function getInitialFormValues(): FormValues {
        return {
            employeeId: "",
            namaPegawai: "",
            tanggalMeeting: "",
            judulMeeting: "",
            deskripsiMeeting: "",
            fotoMeeting: null,
            melaksanakanMeeting: "",
            alasanTidakMeeting: "",
            alasanLainnya: "",
        };
    }
    interface QuillEditor {
        on: (event: string, handler: (...args: unknown[]) => void) => void;
        root: HTMLElement;
        setContents: (delta: unknown[]) => void;
        disable: () => void;
        getSemanticHTML: () => string;
    }

    const quillFontWhitelist = [
        "Arial",
        "Courier",
        "Garamond",
        "Tahoma",
        "Times New Roman",
        "Verdana",
    ];

    let quillInstance: QuillEditor | null = null;
    let QuillClass: any = null; // cached module
    let quillSetupPromise: Promise<void> | null = null;

    let form = $state<FormValues>(getInitialFormValues());
    let errors = $state<FormErrors>({});
    let notice = $state<Notice | null>(null);
    let imagePreview = $state<string | null>(null);
    let isSubmitting = $state(false);
    let fileInput = $state<HTMLInputElement | undefined>(undefined);
    let linkedCalendarEventId = $state<string>("");
    let isLinkedCalendarPrefill = $state(false);

    function clearFieldError(field: FieldName): void {
        if (!errors[field]) {
            return;
        }

        errors = { ...errors, [field]: undefined };
    }

    function updateField<K extends FieldName>(
        field: K,
        value: FormValues[K],
    ): void {
        form[field] = value;
        clearFieldError(field);
    }

    function updateImagePreview(file: File | null): void {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }

        imagePreview = file ? URL.createObjectURL(file) : null;
    }

    function removeImage(): void {
        updateImagePreview(null);
        updateField("fotoMeeting", null);

        if (fileInput) {
            fileInput.value = "";
        }
    }

    function resetForm(): void {
        const employeeId = form.employeeId;
        removeImage();
        form = getInitialFormValues();
        form.employeeId = employeeId;
        errors = {};
        quillInstance?.setContents([]);
    }

    function setNotice(
        type: Notice["type"],
        title: string,
        description?: string,
    ): void {
        notice = { type, title, description };
    }

    function formatDisplayDate(value: string): string {
        if (!value) {
            return "Pilih tanggal";
        }

        const date = new Date(`${value}T00:00:00`);

        return new Intl.DateTimeFormat("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(date);
    }

    function validateForm(): boolean {
        const nextErrors: FormErrors = {};

        if (!form.employeeId.trim()) {
            nextErrors.employeeId =
                "Employee ID tidak ditemukan. Silakan login ulang";
        }
        if (!form.namaPegawai.trim())
            nextErrors.namaPegawai = "Nama pegawai wajib diisi";
        if (!form.tanggalMeeting)
            nextErrors.tanggalMeeting = "Tanggal meeting wajib diisi";
        if (!form.judulMeeting.trim())
            nextErrors.judulMeeting = "Judul meeting wajib diisi";
        if (!form.melaksanakanMeeting) {
            nextErrors.melaksanakanMeeting = "Pilihan meeting wajib diisi";
        }

        if (form.melaksanakanMeeting === "Ya") {
            if (!form.deskripsiMeeting.trim()) {
                nextErrors.deskripsiMeeting = "Deskripsi meeting wajib diisi";
            }
            if (!form.fotoMeeting) {
                nextErrors.fotoMeeting = "Foto acara wajib diupload";
            }
        }

        errors = nextErrors;

        const firstError = Object.values(nextErrors)[0];

        if (firstError) {
            setNotice("error", "Form tidak lengkap", firstError);
        }

        return Object.keys(nextErrors).length === 0;
    }

    function handleImageChange(event: Event): void {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0] ?? null;

        clearFieldError("fotoMeeting");

        if (!file) {
            removeImage();
            return;
        }

        if (!file.type.startsWith("image/")) {
            input.value = "";
            setNotice(
                "error",
                "File tidak valid",
                "Hanya file gambar yang diperbolehkan",
            );
            errors = {
                ...errors,
                fotoMeeting: "Hanya file gambar yang diperbolehkan",
            };
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            input.value = "";
            setNotice(
                "error",
                "File terlalu besar",
                "Ukuran file maksimal 5MB",
            );
            errors = { ...errors, fotoMeeting: "Ukuran file maksimal 5MB" };
            return;
        }

        updateField("fotoMeeting", file);
        updateImagePreview(file);
    }

    function appendIfPresent(
        payload: FormData,
        key: string,
        value: string,
    ): void {
        if (value.trim()) {
            payload.append(key, value.trim());
        }
    }

    function toDateInputValue(value: string): string {
        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
            return "";
        }

        return parsed.toISOString().slice(0, 10);
    }

    async function handleSubmit(event: SubmitEvent): Promise<void> {
        event.preventDefault();
        notice = null;

        if (!validateForm()) {
            return;
        }

        isSubmitting = true;

        try {
            const payload = new FormData();

            appendIfPresent(payload, "employeeId", form.employeeId);
            appendIfPresent(payload, "eventId", linkedCalendarEventId);
            appendIfPresent(payload, "namaPegawai", form.namaPegawai);
            appendIfPresent(payload, "tanggalMeeting", form.tanggalMeeting);
            appendIfPresent(payload, "judulMeeting", form.judulMeeting);
            appendIfPresent(
                payload,
                "melaksanakanMeeting",
                form.melaksanakanMeeting,
            );

            if (form.melaksanakanMeeting === "Ya") {
                appendIfPresent(
                    payload,
                    "deskripsiMeeting",
                    form.deskripsiMeeting,
                );
                if (form.fotoMeeting) {
                    payload.append("fotoMeeting", form.fotoMeeting);
                }
            }

            if (form.melaksanakanMeeting === "Tidak") {
                appendIfPresent(
                    payload,
                    "alasanTidakMeeting",
                    form.alasanTidakMeeting,
                );
                appendIfPresent(payload, "alasanLainnya", form.alasanLainnya);
            }

            const response = await fetch("/api/form-submission", {
                method: "POST",
                body: payload,
            });

            const result = (await response.json()) as { error?: string };

            if (!response.ok) {
                throw new Error(result.error ?? "Gagal mengirim laporan");
            }

            setNotice(
                "success",
                "Form berhasil disubmit",
                "Data laporan meeting telah tersimpan.",
            );
            resetForm();
            await goto('/calendar');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Terjadi kesalahan";
            setNotice("error", "Gagal mengirim form", message);
        } finally {
            isSubmitting = false;
        }
    }

    onDestroy(() => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
    });

    onMount(async () => {
        const employeeId =
            sessionStorage.getItem("meeting-note-employee-id") ?? "";
        const eventId = new URLSearchParams(window.location.search).get("eventId") ?? "";

        if (employeeId) {
            updateField("employeeId", employeeId);
        }

        if (eventId) {
            linkedCalendarEventId = eventId;

            try {
                const response = await fetch(`/api/calendar?eventId=${eventId}`);
                const result =
                    (await response.json()) as CalendarEventPrefillResponse;

                if (!response.ok || !result.event) {
                    throw new Error(result.error ?? "Gagal memuat data meeting");
                }

                form.judulMeeting = result.event.title;
                form.tanggalMeeting = toDateInputValue(result.event.startTime);
                isLinkedCalendarPrefill = true;
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Gagal memuat data meeting";
                setNotice("error", "Gagal memuat meeting", message);
            }
        }

        quillSetupPromise = (async () => {
            if (QuillClass) {
                return;
            }

            const mod = await import("quill");
            const Quill = mod.default;

            const FontStyle = Quill.import("attributors/style/font") as {
                whitelist: string[];
            };
            const AlignStyle = Quill.import("attributors/style/align") as any;

            FontStyle.whitelist = quillFontWhitelist;

            Quill.register(FontStyle as any, true);
            Quill.register(AlignStyle, true);

            QuillClass = Quill;
        })();

        await quillSetupPromise;
    });

    function initQuillEditor(node: HTMLDivElement) {
        let destroyed = false;

        (async () => {
            if (quillSetupPromise) {
                await quillSetupPromise;
            }

            if (destroyed || !QuillClass) {
                return;
            }

            const editor: QuillEditor = new QuillClass(node, {
                theme: "snow",
                placeholder:
                    "Tuliskan ringkasan hasil meeting, agenda, atau poin penting pembahasan",
                modules: {
                    toolbar: [
                        ["bold", "italic", "underline", "strike"],
                        ["blockquote", "code-block"],
                        [{ header: 1 }, { header: 2 }],
                        [{ header: [1, 2, 3, 4, 5, 6, false] }],
                        [{ list: "ordered" }, { list: "bullet" }],
                        [{ indent: "-1" }, { indent: "+1" }],
                        [{ align: [] }],
                        [{ direction: "rtl" }],
                        [{ script: "sub" }, { script: "super" }],
                        [{ size: ["small", false, "large", "huge"] }],
                        [{ font: quillFontWhitelist }],
                        [{ color: [] }, { background: [] }],
                        ["link", "image", "video", "formula"],
                        ["clean"],
                    ],
                },
            });

            if (destroyed) return;

            quillInstance = editor;

            editor.on("text-change", () => {
                const html = editor.getSemanticHTML();
                form.deskripsiMeeting = html === "<p><br></p>" ? "" : html;
                clearFieldError("deskripsiMeeting");
            });
        })();

        return {
            destroy() {
                destroyed = true;
                quillInstance = null;
            },
        };
    }
</script>

<svelte:head>
    <title>Form Submission</title>
    <meta
        name="description"
        content="Form laporan FA Program GOCAP dengan upload foto pemenang dan validasi dinamis."
    />
    <link
        href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css"
        rel="stylesheet"
    />
</svelte:head>

<div class="page-shell">
    <section class="form-card">
        <div class="hero-copy">
            <p class="eyebrow">Dinas Perencanaan Dan Pembangunan Daerah</p>
            <h1>Form Laporan Meeting</h1>
            <p class="lede">
                Diperuntukkan untuk mencatat hasil rapat dan kegiatan terkait.
            </p>
        </div>

        {#if notice}
            <div
                class={`notice ${notice.type}`}
                role="status"
                aria-live="polite"
            >
                <strong>{notice.title}</strong>
                {#if notice.description}
                    <span>{notice.description}</span>
                {/if}
            </div>
        {/if}

        <form class="report-form" onsubmit={handleSubmit}>
            <div class="field-grid">
                <label class="field">
                    <span>Employee ID*</span>
                    <input
                        type="text"
                        bind:value={form.employeeId}
                        readonly
                        placeholder="Auto dari session"
                    />
                    {#if errors.employeeId}<small>{errors.employeeId}</small
                        >{/if}
                </label>

                <label class="field">
                    <span>Nama Pegawai*</span>
                    <input
                        type="text"
                        bind:value={form.namaPegawai}
                        oninput={() => clearFieldError("namaPegawai")}
                        placeholder="Masukkan nama pegawai"
                    />
                    {#if errors.namaPegawai}<small>{errors.namaPegawai}</small
                        >{/if}
                </label>

                <label class="field">
                    <span>Tanggal Meeting*</span>
                    <input
                        type="date"
                        bind:value={form.tanggalMeeting}
                        max={new Date().toISOString().slice(0, 10)}
                        oninput={() => clearFieldError("tanggalMeeting")}
                        disabled={isLinkedCalendarPrefill}
                    />
                    <em>{formatDisplayDate(form.tanggalMeeting)}</em>
                    {#if errors.tanggalMeeting}<small
                            >{errors.tanggalMeeting}</small
                        >{/if}
                </label>

                <label class="field">
                    <span>Judul Meeting *</span>
                    <input
                        type="text"
                        bind:value={form.judulMeeting}
                        oninput={() => clearFieldError("judulMeeting")}
                        placeholder="Masukkan judul meeting"
                        readonly={isLinkedCalendarPrefill}
                    />
                    {#if errors.judulMeeting}<small>{errors.judulMeeting}</small
                        >{/if}
                </label>
            </div>

            <fieldset class="choice-group">
                <legend>Apakah anda sudah melaksanakan meeting? *</legend>
                <div class="radio-row">
                    <label
                        ><input
                            type="radio"
                            bind:group={form.melaksanakanMeeting}
                            value="Ya"
                        /> Ya</label
                    >
                    <label
                        ><input
                            type="radio"
                            bind:group={form.melaksanakanMeeting}
                            value="Tidak"
                        /> Tidak</label
                    >
                </div>
                {#if errors.melaksanakanMeeting}<small
                        >{errors.melaksanakanMeeting}</small
                    >{/if}
            </fieldset>

            {#if form.melaksanakanMeeting === "Ya"}
                <section class="conditional-block">
                    <h2>Data Meeting</h2>

                    <div class="field-grid">
                        <div class="field field-full">
                            <span>Deskripsi Meeting *</span>
                            <div
                                use:initQuillEditor
                                class="quill-editor"
                            ></div>
                            {#if errors.deskripsiMeeting}<small
                                    >{errors.deskripsiMeeting}</small
                                >{/if}
                        </div>

                        <div class="field field-full">
                            <span>Foto Meeting *</span>
                            <div class="upload-panel">
                                <input
                                    bind:this={fileInput}
                                    type="file"
                                    accept="image/*"
                                    onchange={handleImageChange}
                                />
                                {#if imagePreview}
                                    <div class="preview-frame">
                                        <img
                                            src={imagePreview}
                                            alt="Preview foto meeting"
                                        />
                                        <button
                                            type="button"
                                            class="ghost-button"
                                            onclick={removeImage}
                                        >
                                            Hapus gambar
                                        </button>
                                    </div>
                                {/if}
                            </div>
                            <em>Format: JPG, PNG, JPEG. Maksimal 5MB.</em>
                            {#if errors.fotoMeeting}<small
                                    >{errors.fotoMeeting}</small
                                >{/if}
                        </div>
                    </div>
                </section>
            {/if}

            {#if form.melaksanakanMeeting === "Tidak"}
                <section class="conditional-block">
                    <h2>Alasan Tidak Menjalankan Program</h2>

                    <fieldset class="choice-group">
                        <legend
                            >Alasan tidak melaksanakan Program GOCAP *</legend
                        >
                        <div class="stacked-options">
                            {#each alasanTidakMeeting as item}
                                <label>
                                    <input
                                        type="radio"
                                        bind:group={form.alasanTidakMeeting}
                                        value={item.value}
                                    />
                                    {item.label}
                                </label>
                            {/each}
                        </div>
                        {#if errors.alasanTidakMeeting}<small
                                >{errors.alasanTidakMeeting}</small
                            >{/if}
                    </fieldset>

                    {#if form.alasanTidakMeeting === "lainnya"}
                        <label class="field">
                            <span>Alasan Lainnya *</span>
                            <input
                                type="text"
                                bind:value={form.alasanLainnya}
                                placeholder="Masukkan alasan lainnya"
                            />
                            {#if errors.alasanLainnya}<small
                                    >{errors.alasanLainnya}</small
                                >{/if}
                        </label>
                    {/if}
                </section>
            {/if}

            <div class="actions">
                <button
                    class="submit-button"
                    type="submit"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Mengirim..." : "Submit"}
                </button>
                <button
                    class="secondary-button"
                    type="button"
                    onclick={resetForm}
                    disabled={isSubmitting}
                >
                    Reset
                </button>
            </div>
        </form>
    </section>
</div>

<style>
    :global(body) {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua",
            serif;
        background: radial-gradient(
                circle at top left,
                rgba(255, 205, 128, 0.35),
                transparent 30%
            ),
            linear-gradient(
                180deg,
                #0d2742 0%,
                #174c6c 50%,
                #f3ede2 50%,
                #f6f0e7 100%
            );
        color: #12212b;
    }

    .page-shell {
        min-height: 100vh;
        padding: 3rem 1.25rem;
    }

    .form-card {
        max-width: 920px;
        margin: 0 auto;
        background: rgba(255, 250, 244, 0.96);
        border: 1px solid rgba(18, 33, 43, 0.12);
        border-radius: 28px;
        box-shadow: 0 24px 70px rgba(8, 27, 39, 0.18);
        overflow: hidden;
    }

    .hero-copy {
        padding: 2.25rem 2.25rem 1rem;
        background: linear-gradient(135deg, #14324a 0%, #0f5d78 100%);
        color: #fff8ef;
    }

    /* Quill editor */
    .quill-editor {
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #cdd9de;
        background: white;
    }

    :global(.quill-editor .ql-toolbar) {
        border: none;
        border-bottom: 1px solid #cdd9de;
        background: #f9f6f1;
    }

    :global(.quill-editor .ql-container) {
        border: none;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua",
            serif;
        font-size: 1rem;
        min-height: 10rem;
    }

    :global(.quill-editor .ql-editor) {
        padding: 0.9rem 1rem;
        min-height: 10rem;
    }

    :global(.quill-editor .ql-editor.ql-blank::before) {
        color: #9ab0bb;
        font-style: normal;
    }

    :global(.quill-editor .ql-font .ql-picker-item[data-value="Arial"]::before),
    :global(.quill-editor .ql-font .ql-picker-label[data-value="Arial"]::before) {
        content: "Arial";
        font-family: Arial, sans-serif;
    }

    :global(.quill-editor .ql-font .ql-picker-item[data-value="Courier"]::before),
    :global(.quill-editor .ql-font .ql-picker-label[data-value="Courier"]::before) {
        content: "Courier";
        font-family: "Courier New", Courier, monospace;
    }

    :global(.quill-editor .ql-font .ql-picker-item[data-value="Garamond"]::before),
    :global(.quill-editor .ql-font .ql-picker-label[data-value="Garamond"]::before) {
        content: "Garamond";
        font-family: Garamond, "Times New Roman", serif;
    }

    :global(.quill-editor .ql-font .ql-picker-item[data-value="Tahoma"]::before),
    :global(.quill-editor .ql-font .ql-picker-label[data-value="Tahoma"]::before) {
        content: "Tahoma";
        font-family: Tahoma, Geneva, sans-serif;
    }

    :global(.quill-editor .ql-font .ql-picker-item[data-value="Times New Roman"]::before),
    :global(.quill-editor .ql-font .ql-picker-label[data-value="Times New Roman"]::before) {
        content: "Times New Roman";
        font-family: "Times New Roman", Times, serif;
    }

    :global(.quill-editor .ql-font .ql-picker-item[data-value="Verdana"]::before),
    :global(.quill-editor .ql-font .ql-picker-label[data-value="Verdana"]::before) {
        content: "Verdana";
        font-family: Verdana, Geneva, sans-serif;
    }

    .eyebrow {
        margin: 0 0 0.4rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        font-size: 0.8rem;
        opacity: 0.78;
    }

    h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.6rem);
        line-height: 0.95;
    }

    .lede {
        max-width: 56ch;
        margin: 0.9rem 0 0;
        font-size: 1rem;
        line-height: 1.6;
    }

    .notice {
        margin: 1.5rem 2.25rem 0;
        padding: 1rem 1.1rem;
        border-radius: 16px;
        display: grid;
        gap: 0.25rem;
    }

    .notice.success {
        background: #e8f7ee;
        color: #0c5733;
    }

    .notice.error {
        background: #fdecec;
        color: #892626;
    }

    .notice.info {
        background: #e9f3fa;
        color: #144f6d;
    }

    .report-form {
        padding: 2rem 2.25rem 2.25rem;
        display: grid;
        gap: 1.5rem;
    }

    .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem 1.1rem;
    }

    .field {
        display: grid;
        gap: 0.45rem;
        font-size: 0.98rem;
    }

    .field-full {
        grid-column: 1 / -1;
    }

    .field span,
    legend,
    h2 {
        font-weight: 700;
    }

    input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cdd9de;
        border-radius: 14px;
        padding: 0.9rem 1rem;
        font: inherit;
        background: white;
        color: inherit;
    }

    input:focus {
        outline: 2px solid rgba(193, 106, 32, 0.24);
        border-color: #c16a20;
    }

    em,
    small {
        font-style: normal;
        font-size: 0.86rem;
        line-height: 1.5;
    }

    em {
        color: #62747d;
    }

    small {
        color: #b23c2f;
    }

    .choice-group,
    .conditional-block {
        border: 1px solid #d6dfdf;
        border-radius: 22px;
        padding: 1.2rem;
        background: rgba(255, 255, 255, 0.82);
    }

    .choice-group {
        display: grid;
        gap: 0.75rem;
    }

    .radio-row,
    .stacked-options {
        display: grid;
        gap: 0.75rem;
    }

    .radio-row {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .radio-row label,
    .stacked-options label {
        display: flex;
        gap: 0.65rem;
        align-items: start;
        padding: 0.85rem 0.95rem;
        border-radius: 14px;
        background: #f4f2ed;
    }

    .radio-row input,
    .stacked-options input {
        width: auto;
        margin-top: 0.15rem;
    }

    .conditional-block {
        display: grid;
        gap: 1rem;
    }

    h2 {
        margin: 0;
        font-size: 1.2rem;
    }

    .upload-panel {
        display: grid;
        gap: 1rem;
    }

    .preview-frame {
        display: grid;
        gap: 0.8rem;
        justify-items: start;
    }

    .preview-frame img {
        width: min(100%, 280px);
        border-radius: 18px;
        border: 1px solid rgba(18, 33, 43, 0.12);
        box-shadow: 0 12px 30px rgba(18, 33, 43, 0.12);
    }

    .actions {
        display: flex;
        gap: 0.8rem;
        justify-content: flex-end;
        flex-wrap: wrap;
    }

    button {
        border: 0;
        border-radius: 999px;
        padding: 0.95rem 1.5rem;
        font: inherit;
        cursor: pointer;
        transition:
            transform 0.18s ease,
            opacity 0.18s ease,
            background 0.18s ease;
    }

    button:hover:enabled {
        transform: translateY(-1px);
    }

    button:disabled {
        opacity: 0.65;
        cursor: wait;
    }

    .submit-button {
        background: linear-gradient(135deg, #c16a20, #dd8d2a);
        color: #fff9f0;
    }

    .secondary-button,
    .ghost-button {
        background: #e7edf0;
        color: #17384f;
    }

    @media (max-width: 720px) {
        .page-shell {
            padding: 1.1rem;
        }

        .hero-copy,
        .report-form {
            padding-left: 1.25rem;
            padding-right: 1.25rem;
        }

        .field-grid {
            grid-template-columns: 1fr;
        }

        .actions {
            justify-content: stretch;
        }

        .actions button {
            width: 100%;
        }
    }
</style>
