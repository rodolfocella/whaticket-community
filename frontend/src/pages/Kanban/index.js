import React, { useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import Chip from "@material-ui/core/Chip";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import connectToSocket from "../../services/socket-io";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  boardWrapper: {
    display: "flex",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    height: "100%",
    overflowX: "auto",
  },
  column: {
    minWidth: 280,
    width: 280,
    display: "flex",
    flexDirection: "column",
    backgroundColor: theme.palette.background.default,
    borderRadius: 8,
    maxHeight: "100%",
  },
  columnHeader: {
    padding: theme.spacing(1.5),
    fontWeight: "bold",
    borderBottom: `2px solid ${theme.palette.divider}`,
  },
  columnBody: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
  },
  card: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    cursor: "pointer",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  cardAvatar: {
    width: 32,
    height: 32,
  },
  cardName: {
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cardLastMessage: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
}));

const COLUMN_IDS = ["pending", "open", "closed"];

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const [ticketsByColumn, setTicketsByColumn] = useState({
    pending: [],
    open: [],
    closed: [],
  });

  const fetchColumn = useCallback(async (status) => {
    const { data } = await api.get("/tickets", {
      params: { status, showAll: "true" },
    });
    return data.tickets;
  }, []);

  const fetchBoard = useCallback(async () => {
    try {
      const results = await Promise.all(
        COLUMN_IDS.map((columnId) => fetchColumn(columnId))
      );
      setTicketsByColumn({
        pending: results[0],
        open: results[1],
        closed: results[2],
      });
    } catch (err) {
      toastError(err);
    }
  }, [fetchColumn]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    const socket = connectToSocket();

    socket.on("connect", () => {
      COLUMN_IDS.forEach((columnId) => socket.emit("joinChatBox", columnId));
    });

    socket.on("ticket", (data) => {
      if (data.action === "update" || data.action === "delete") {
        fetchBoard();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchBoard]);

  const moveTicket = async (ticket, newStatus) => {
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: newStatus,
        userId: ticket.userId,
        queueId: ticket.queueId,
      });
    } catch (err) {
      toastError(err);
      fetchBoard();
    }
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceColumn = source.droppableId;
    const destColumn = destination.droppableId;

    const sourceTickets = Array.from(ticketsByColumn[sourceColumn]);
    const [movedTicket] = sourceTickets.splice(source.index, 1);

    if (sourceColumn === destColumn) {
      sourceTickets.splice(destination.index, 0, movedTicket);
      setTicketsByColumn((prev) => ({
        ...prev,
        [sourceColumn]: sourceTickets,
      }));
      return;
    }

    const destTickets = Array.from(ticketsByColumn[destColumn]);
    destTickets.splice(destination.index, 0, {
      ...movedTicket,
      status: destColumn,
    });

    setTicketsByColumn((prev) => ({
      ...prev,
      [sourceColumn]: sourceTickets,
      [destColumn]: destTickets,
    }));

    moveTicket(movedTicket, destColumn);
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("kanban.title")}</Title>
      </MainHeader>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className={classes.boardWrapper}>
          {COLUMN_IDS.map((columnId) => (
            <div key={columnId} className={classes.column}>
              <Typography className={classes.columnHeader}>
                {i18n.t(`kanban.columns.${columnId}`)}{" "}
                <Chip
                  size="small"
                  label={ticketsByColumn[columnId]?.length || 0}
                />
              </Typography>
              <Droppable droppableId={columnId}>
                {(provided) => (
                  <div
                    className={classes.columnBody}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {(ticketsByColumn[columnId] || []).map((ticket, index) => (
                      <Draggable
                        key={ticket.id}
                        draggableId={String(ticket.id)}
                        index={index}
                      >
                        {(dragProvided) => (
                          <Paper
                            className={classes.card}
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            onClick={() =>
                              history.push(`/tickets/${ticket.uuid || ticket.id}`)
                            }
                          >
                            <div className={classes.cardHeader}>
                              <Avatar
                                className={classes.cardAvatar}
                                src={ticket.contact?.profilePicUrl}
                              />
                              <span className={classes.cardName}>
                                {ticket.contact?.name}
                              </span>
                            </div>
                            <Typography className={classes.cardLastMessage}>
                              {ticket.lastMessage}
                            </Typography>
                          </Paper>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </MainContainer>
  );
};

export default Kanban;
