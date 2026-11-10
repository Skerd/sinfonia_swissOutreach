import {compose} from "redux";
import {useState} from "react";
import withLanguage, {WithLanguageType} from "@coreModule/helpers/hocs/withLanguage.tsx";
import withDebug from "@coreModule/helpers/hocs/withDebug.tsx";
import {useAccess} from "@coreModule/helpers/hooks/useAccess.ts";
import SheetViewRenderer from "@coreModule/components/viewEngine/SheetViewRenderer.tsx";
import {useViewConfig} from "@coreModule/helpers/hooks/useViewConfig.ts";

type OutreachEmailSheetViewOwnProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fetchId: string;
};

/** One email's sheet. Its review actions live on the approval row, so the sheet only reads. */
function OutreachEmailSheetView({open, onOpenChange, fetchId, resolveLanguageKey}: OutreachEmailSheetViewOwnProps & WithLanguageType) {
    const [sheetData, setSheetData] = useState<Record<string, unknown>>({_id: fetchId});
    const access = useAccess("swissoutreachemails");
    const viewConfig = useViewConfig("swissoutreachemails", "sheet");

    if (!viewConfig) return null;

    return (
        <SheetViewRenderer
            config={viewConfig}
            url="/api/swissOutreach/outreachEmail/single"
            fetchId={fetchId}
            onDataFetched={(data) => setSheetData(data)}
            data={sheetData}
            open={open}
            onOpenChange={onOpenChange}
            resolveLanguageKey={resolveLanguageKey}
            access={access}
            hideActions
        />
    );
}

export default compose(
    withLanguage("src/modules/swissOutreach/clients/panel/private/approval/outreachEmailSheetView.tsx"),
    withDebug(true, true, "swissoutreachemails"),
)(OutreachEmailSheetView);
