import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { VirtualList } from "./VirtualList";

const meta: Meta<typeof VirtualList> = {
  title: "components/VirtualList",
  component: VirtualList,
};

export default meta;
type Story = StoryObj<typeof VirtualList>;

function VirtualListInteractiveStory() {
  const items = Array.from({ length: 100 }, (_, i) => `Row ${i + 1}`);
  const [scrollTopPx, setScrollTopPx] = React.useState(0);

  return (
    <VirtualList
      items={items}
      itemHeightPx={32}
      heightPx={240}
      scrollTopPx={scrollTopPx}
      onScroll={(event) => setScrollTopPx(event.currentTarget.scrollTop)}
      renderItem={(item) => <div style={{ padding: "6px 10px" }}>{item}</div>}
    />
  );
}

export const Basic: Story = {
  render: () => <VirtualListInteractiveStory />,
};
