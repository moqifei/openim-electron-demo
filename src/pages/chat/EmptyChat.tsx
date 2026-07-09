import { Empty, Layout } from "antd";
import { useTranslation } from "react-i18next";

export const EmptyChat = () => {
  const { t } = useTranslation();

  return (
    <Layout className="no-mobile flex items-center justify-center bg-white">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t("placeholder.conversation")}
      />
    </Layout>
  );
};
