# P4-T3 expected

- POST /nodes/{node_id}/rename
  - returns 200 and updated `name`.
- POST /nodes/{node_id}/move
  - moves a node under another folder and updates parent/name.
- POST /nodes/{node_id}/copy
  - copies subtree under another folder and returns new node.
- name validation uses Rename/MoveCopyRequest contract (`new_name`, `destination_parent_id`).
