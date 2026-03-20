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

    type MeetingOption = "" | "Ya" | "Tidak";
    const alasanTidakMeeting = [
        { value: "lupa", label: "Lupa" },
        {
            value: "tidak-tahu",
            label: "Tidak mengetahui program ini dan takut salah"
        },
        { value: "lainnya", label: "Other" },
    ];

    interface FormValues {
        employeeId: string;
        namaPegawai: string;
        nomorPegawaian: string;
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
            nomorPegawaian: "",
            tanggalMeeting: "",
            judulMeeting: "",
            deskripsiMeeting: "",
            fotoMeeting: null,
            melaksanakanMeeting: "",
            alasanTidakMeeting: "",
            alasanLainnya: "",
        };
    }

    let form = $state<FormValues>(getInitialFormValues());
    let errors = $state<FormErrors>({});
    let notice = $state<Notice | null>(null);
    let imagePreview = $state<string | null>(null);
    let isSubmitting = $state(false);
    let fileInput = $state<HTMLInputElement | undefined>(undefined);

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
            nextErrors.employeeId = "Employee ID tidak ditemukan. Silakan login ulang";
        }
        if (!form.namaPegawai.trim())
            nextErrors.namaPegawai = "Nama pegawai wajib diisi";
        if (!form.nomorPegawaian.trim()) {
            nextErrors.nomorPegawaian = "Nomor pegawaian wajib diisi";
        } else if (!/^\d+$/.test(form.nomorPegawaian.trim())) {
            nextErrors.nomorPegawaian = "Hanya boleh input angka";
        }
        if (!form.tanggalMeeting)
            nextErrors.tanggalMeeting = "Tanggal meeting wajib diisi";
        if (!form.judulMeeting.trim())
            nextErrors.judulMeeting = "Judul meeting wajib diisi";
        if (!form.melaksanakanMeeting) {
            nextErrors.melaksanakanMeeting = "Pilihan meeting wajib diisi";
        }

        if (form.melaksanakanMeeting === "Ya") {
            if (!form.deskripsiMeeting.trim()) {
                nextErrors.deskripsiMeeting =
                    "Deskripsi meeting wajib diisi";
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
            appendIfPresent(payload, "namaPegawai", form.namaPegawai);
            appendIfPresent(payload, "nomorPegawaian", form.nomorPegawaian);
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

    onMount(() => {
        const employeeId = sessionStorage.getItem("meeting-note-employee-id") ?? "";

        if (employeeId) {
            updateField("employeeId", employeeId);
        }
    });
</script>

<svelte:head>
    <title>Form Submission</title>
    <meta
        name="description"
        content="Form laporan FA Program GOCAP dengan upload foto pemenang dan validasi dinamis."
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
                    {#if errors.employeeId}<small>{errors.employeeId}</small>{/if}
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
                    <span>Nomor Pegawaian*</span>
                    <input
                        type="text"
                        bind:value={form.nomorPegawaian}
                        oninput={() => clearFieldError("nomorPegawaian")}
                        placeholder="Masukkan nomor pegawaian"
                    />
                    {#if errors.nomorPegawaian}<small
                            >{errors.nomorPegawaian}</small
                        >{/if}
                </label>

                <label class="field">
                    <span>Tanggal Meeting*</span>
                    <input
                        type="date"
                        bind:value={form.tanggalMeeting}
                        max={new Date().toISOString().slice(0, 10)}
                        oninput={() => clearFieldError("tanggalMeeting")}
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
                        <label class="field field-full">
                            <span>Deskripsi Meeting *</span>
                            <textarea
                                bind:value={form.deskripsiMeeting}
                                oninput={() => clearFieldError("deskripsiMeeting")}
                                placeholder="Tuliskan ringkasan hasil meeting, agenda, atau poin penting pembahasan"
                                rows="6"
                            ></textarea>
                            {#if errors.deskripsiMeeting}<small
                                    >{errors.deskripsiMeeting}</small
                                >{/if}
                        </label>

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

    input,
    textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cdd9de;
        border-radius: 14px;
        padding: 0.9rem 1rem;
        font: inherit;
        background: white;
        color: inherit;
    }

    textarea {
        resize: vertical;
        min-height: 10rem;
    }

    input:focus,
    textarea:focus {
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
