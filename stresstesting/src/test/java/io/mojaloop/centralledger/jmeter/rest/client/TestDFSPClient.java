package io.mojaloop.centralledger.jmeter.rest.client;

import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Participant;
import io.mojaloop.centralledger.jmeter.rest.client.json.transfer.Transfer;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Test;

import java.util.List;
import java.util.UUID;

public class TestDFSPClient {
	private DFSPClient dfspClient;

	@Before
	public void init() {
		this.dfspClient = new DFSPClient("http://localhost:3001");
	}

	@After
	public void destroy() {
		this.dfspClient.closeAndClean();
	}

	@Test
	@Ignore
	public void testLookupTransfer() {
		this.dfspClient.jMeterTransferLookup("payerFsp47385337", "ceea9e74-e4a8-4471-84e8-ce03c0bd1b76");
	}

	@Test
	@Ignore
	public void testCreateTransfer() {
		Transfer transfer = new Transfer(new JSONObject());
		transfer.setTransferId(UUID.randomUUID().toString());
		transfer.setFulfil(true);

		this.dfspClient.jMeterTransferPrepare(transfer);
	}


	@Test
	@Ignore
	public void testFetchAllParticipantsTransfer() {
		List<Participant> allParticipants = this.dfspClient.getAllParticipants();

		System.out.println(allParticipants);
	}
}
