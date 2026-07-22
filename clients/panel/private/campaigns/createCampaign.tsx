import {compose} from "redux";
import {FormEvent, useState} from "react";
import {useNavigate} from "react-router-dom";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import apiClient from "@coreModule/helpers/axiosClients/apiClient.ts";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";

const fieldClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function CreateCampaignPage({}: WithLanguageType) {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        jobDescription: "",
        country: "Switzerland",
        cantons: "BS,BL",
        maxCompanies: 20,
        language: "de",
        emailTone: "professional",
        sendAutomatically: false,
        senderCompanyName: "",
        senderName: "",
        senderEmail: "",
        senderPhone: "",
        senderWebsite: "",
        additionalNotes: "",
    });

    const onChange = (key: string, value: string | number | boolean) => {
        setForm((prev) => ({...prev, [key]: value}));
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                cantons: form.cantons
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                maxCompanies: Number(form.maxCompanies),
                senderWebsite: form.senderWebsite || undefined,
                senderPhone: form.senderPhone || undefined,
                additionalNotes: form.additionalNotes || undefined,
            };
            const res = await apiClient.put<Campaign>("/api/swissOutreach/campaign", payload);
            const id = res.data?._id;
            navigate(id ? `/swissOutreach/campaigns/detail?campaignId=${id}` : "/swissOutreach/campaigns");
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || "Create failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
            <h1 className="text-xl font-semibold">New Swiss Outreach Campaign</h1>
            <p className="text-sm text-slate-600">
                Describe the job, choose cantons, and provide sender identity. Emails default to human approval
                before sending.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                <div>
                    <label className={labelClass}>Job description</label>
                    <textarea
                        className={fieldClass}
                        rows={5}
                        required
                        value={form.jobDescription}
                        onChange={(e) => onChange("jobDescription", e.target.value)}
                    />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <label className={labelClass}>Country</label>
                        <input className={fieldClass} value={form.country} onChange={(e) => onChange("country", e.target.value)} required />
                    </div>
                    <div>
                        <label className={labelClass}>Cantons (comma-separated codes)</label>
                        <input className={fieldClass} value={form.cantons} onChange={(e) => onChange("cantons", e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Maximum companies</label>
                        <input
                            className={fieldClass}
                            type="number"
                            min={1}
                            max={500}
                            value={form.maxCompanies}
                            onChange={(e) => onChange("maxCompanies", Number(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Language</label>
                        <select className={fieldClass} value={form.language} onChange={(e) => onChange("language", e.target.value)}>
                            <option value="de">German</option>
                            <option value="fr">French</option>
                            <option value="it">Italian</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Email tone</label>
                        <select className={fieldClass} value={form.emailTone} onChange={(e) => onChange("emailTone", e.target.value)}>
                            <option value="professional">Professional</option>
                            <option value="friendly">Friendly</option>
                            <option value="formal">Formal</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2 pb-2">
                        <input
                            id="sendAutomatically"
                            type="checkbox"
                            checked={form.sendAutomatically}
                            onChange={(e) => onChange("sendAutomatically", e.target.checked)}
                        />
                        <label htmlFor="sendAutomatically" className="text-sm text-slate-700">
                            Send automatically (skip approval)
                        </label>
                    </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <label className={labelClass}>Company name</label>
                        <input className={fieldClass} required value={form.senderCompanyName} onChange={(e) => onChange("senderCompanyName", e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Sender name</label>
                        <input className={fieldClass} required value={form.senderName} onChange={(e) => onChange("senderName", e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Sender email</label>
                        <input className={fieldClass} type="email" required value={form.senderEmail} onChange={(e) => onChange("senderEmail", e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Sender phone</label>
                        <input className={fieldClass} value={form.senderPhone} onChange={(e) => onChange("senderPhone", e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Website</label>
                        <input className={fieldClass} value={form.senderWebsite} onChange={(e) => onChange("senderWebsite", e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Additional notes</label>
                        <textarea className={fieldClass} rows={3} value={form.additionalNotes} onChange={(e) => onChange("additionalNotes", e.target.value)} />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                    {saving ? "Starting…" : "Create & start pipeline"}
                </button>
            </form>
        </div>
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/campaigns/createCampaign.tsx"),
    withDebug(true, true),
)(CreateCampaignPage);
