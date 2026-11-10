import {useEffect, useMemo, useState} from "react";
import useHttpRequest, {type HttpRequest} from "@coreModule/helpers/hooks/useHttpRequest.ts";
import {ApiSelect} from "@coreModule/components/viewEngine/widgets/inputs/apiSelect/apiSelect.tsx";
import type {SelectOption} from "@coreModule/helpers/hooks/components/useApiSelectOptions.ts";
import type {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import type {Campaign} from "armonia/src/modules/swissOutreach/api/swissOutreach/private/campaign/campaign.dto.ts";

const CAMPAIGN_SELECT_URL = "/api/swissOutreach/campaign/select";
const CAMPAIGN_REQUEST: HttpRequest = {method: "post", url: "/api/swissOutreach/campaign/single"};

type Props = Pick<WithLanguageType, "resolveLanguageKey"> & {
    value: string;
    onChange: (campaignId: string) => void;
    placeholder: string;
    className?: string;
};

/**
 * Picks a campaign by searching its name on the campaign select route, page by page, so every campaign can be picked
 * (TD-B146). A pick carries its name; a campaign given from outside (a link, the first campaign) is looked up once.
 */
export default function CampaignPicker({value, onChange, placeholder, className, resolveLanguageKey}: Props) {
    const [picked, setPicked] = useState<SelectOption | null>(null);
    const [lookupCount, setLookupCount] = useState(0);
    const needsLookup = Boolean(value) && picked?.value !== value;
    useEffect(() => {
        if (needsLookup) setLookupCount((count) => count + 1);
    }, [value, needsLookup]);
    const lookup = useHttpRequest<Campaign>(CAMPAIGN_REQUEST, {_id: value}, lookupCount);
    const lookedUp = lookup.data;

    const defaultOptions = useMemo<SelectOption[]>(() => {
        if (picked?.value === value) return [picked];
        return lookedUp && lookedUp._id === value && lookedUp.name ? [{value, label: lookedUp.name}] : [];
    }, [picked, lookedUp, value]);

    return (
        <ApiSelect
            apiUrl={CAMPAIGN_SELECT_URL}
            value={value}
            onValueChange={(next: string | string[], label?: string | string[]) => {
                const campaignId = String(next);
                setPicked(campaignId ? {value: campaignId, label: String(label ?? campaignId)} : null);
                onChange(campaignId);
            }}
            defaultOptions={defaultOptions}
            placeholder={placeholder}
            resolveLanguageKey={resolveLanguageKey}
            className={className}
        />
    );
}
